'use strict';

const erp = require('../src/services/erpBridge.service');

// The bridge into Afya Nyumbani's management software.
//
// Two things are worth holding down here. One is the shape, because it
// is not ours: the ERP validates fullName, phone, serviceType,
// preferredDate and notes and rejects anything else, so a field renamed
// on our side has to fail here rather than in production at midnight.
//
// The other is the lossy part. The ERP keeps a date with no time and
// has no column for an address, and a nurse cannot turn up at "the
// 24th" in "Dar es Salaam". Both are folded into notes. That is a real
// compromise and it is tested so that nobody later removes it thinking
// it is decoration.

const ORIGINAL = { url: process.env.ERP_BOOKINGS_URL, key: process.env.ERP_API_KEY };

afterEach(() => {
  process.env.ERP_BOOKINGS_URL = ORIGINAL.url ?? '';
  process.env.ERP_API_KEY = ORIGINAL.key ?? '';
  if (!ORIGINAL.url) delete process.env.ERP_BOOKINGS_URL;
  if (!ORIGINAL.key) delete process.env.ERP_API_KEY;
  global.fetch = undefined;
});

const context = {
  booking: {
    id: 'bk-123',
    scheduledAt: new Date('2026-10-24T14:30:00.000Z'),
    locationAddress: 'Mikocheni B, karibu na duka la Mama Ally',
    locationLat: -6.7712,
    locationLng: 39.2405,
    notes: 'Mlango wa pili kushoto',
  },
  service: { name: 'Home Nursing' },
  familyMember: { name: 'Bibi Mwajuma' },
  client: { name: 'Joseph Mushi', phone: '0712345678' },
};

describe('The shape the ERP actually accepts', () => {
  it('sends the five fields it validates, and nothing else', () => {
    const payload = erp.toErpBooking(context);
    expect(Object.keys(payload).sort()).toEqual([
      'fullName',
      'notes',
      'phone',
      'preferredDate',
      'serviceType',
    ]);
  });

  it('names the patient, not the person who placed the order', () => {
    // The ERP converts a booking into a patient record, so the record
    // has to be about whoever is being cared for.
    const payload = erp.toErpBooking(context);
    expect(payload.fullName).toBe('Bibi Mwajuma');
    expect(payload.notes).toContain('Ameagiza: Joseph Mushi');
  });

  it('sends the account phone, because that is the one that answers', () => {
    expect(erp.toErpBooking(context).phone).toBe('0712345678');
  });

  it('sends the date in the format the ERP validates', () => {
    expect(erp.toErpBooking(context).preferredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('What the ERP has no column for', () => {
  it('keeps the address, in notes', () => {
    expect(erp.toErpBooking(context).notes).toContain('Mikocheni B');
  });

  it('keeps the time of day, in notes', () => {
    // preferredDate is a DATE. Without this a nurse knows the day and
    // not the hour.
    expect(erp.toErpBooking(context).notes).toMatch(/Saa: \d{2}:\d{2}/);
  });

  it('keeps the map pin when there is one', () => {
    expect(erp.toErpBooking(context).notes).toContain('-6.7712,39.2405');
  });

  it('carries our booking id, so the two systems can be reconciled', () => {
    expect(erp.toErpBooking(context).notes).toContain('bk-123');
  });

  it('stays inside the 1000 characters the ERP allows', () => {
    const wordy = {
      ...context,
      booking: { ...context.booking, notes: 'x'.repeat(4000) },
    };
    expect(erp.toErpBooking(wordy).notes.length).toBeLessThanOrEqual(1000);
  });

  it('leaves out the orderer when they are the patient', () => {
    const self = { ...context, familyMember: { name: 'Joseph Mushi' } };
    expect(erp.toErpBooking(self).notes).not.toContain('Ameagiza');
  });
});

describe('Sending', () => {
  it('does nothing when the bridge is not configured', async () => {
    delete process.env.ERP_BOOKINGS_URL;
    delete process.env.ERP_API_KEY;
    global.fetch = jest.fn();

    const result = await erp.sendBooking(context);

    expect(result).toEqual({ sent: false, reason: 'NOT_CONFIGURED' });
    // The point: shipping this before the far end exists changes
    // nothing about what happens to a booking today.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts with the key, not a cookie', async () => {
    process.env.ERP_BOOKINGS_URL = 'https://erp.example/api/integrations/bookings';
    process.env.ERP_API_KEY = 'secret-value';
    global.fetch = jest.fn(async () => ({ ok: true, status: 201, text: async () => '{}' }));

    const result = await erp.sendBooking(context);

    expect(result.sent).toBe(true);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://erp.example/api/integrations/bookings');
    expect(init.headers['X-Api-Key']).toBe('secret-value');
    expect(JSON.parse(init.body).fullName).toBe('Bibi Mwajuma');
  });

  it('does not retry a payload the ERP rejected', async () => {
    process.env.ERP_BOOKINGS_URL = 'https://erp.example/api/integrations/bookings';
    process.env.ERP_API_KEY = 'secret-value';
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, text: async () => 'Data sio sahihi' }));

    const result = await erp.sendBooking(context);

    expect(result.sent).toBe(false);
    // A 400 will be a 400 again. Retrying it just delays the log entry
    // that somebody needs to read.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries when the far end is having a bad day', async () => {
    process.env.ERP_BOOKINGS_URL = 'https://erp.example/api/integrations/bookings';
    process.env.ERP_API_KEY = 'secret-value';
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls < 3) return { ok: false, status: 503, text: async () => 'down' };
      return { ok: true, status: 201, text: async () => '{}' };
    });

    const result = await erp.sendBooking(context);

    expect(result.sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up quietly rather than throwing at the booking', async () => {
    process.env.ERP_BOOKINGS_URL = 'https://erp.example/api/integrations/bookings';
    process.env.ERP_API_KEY = 'secret-value';
    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(erp.sendBooking(context)).resolves.toMatchObject({ sent: false });
  });
});
