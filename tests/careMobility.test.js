'use strict';

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Booking, Service, StatusHistory, AuditLog, AppSetting } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const phones = {
  client: `0751${suffix}`,
  other: `0752${suffix}`,
  nurseA: `0753${suffix}`,
  nurseB: `0754${suffix}`,
};

// Inside the seeded Dar es Salaam zone, and well outside it (Arusha).
const IN_ZONE = { lat: -6.8, lng: 39.27 };
const OUT_OF_ZONE = { lat: -3.37, lng: 36.68 };

let tokens = {};
let staff = {};
let familyMemberId;
let otherFamilyMemberId;
let serviceId;

let slot = 0;
function future(hours = 72) {
  slot += 1;
  return new Date(Date.now() + (hours + slot * 5) * 3600 * 1000).toISOString();
}

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

async function register(who, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Care Mobility ${who}`, phone: phones[who], password: 'TestPass123', ...extra });
  tokens[who] = res.body.data.tokens.accessToken;
}

function booking(overrides = {}) {
  return {
    familyMemberId,
    serviceId,
    locationAddress: 'Mikocheni B, Dar es Salaam',
    locationLat: IN_ZONE.lat,
    locationLng: IN_ZONE.lng,
    scheduledAt: future(),
    ...overrides,
  };
}

function trip(overrides = {}) {
  return {
    familyMemberId,
    pickupAddress: 'Sinza Mori, Dar es Salaam',
    pickupLat: IN_ZONE.lat,
    pickupLng: IN_ZONE.lng,
    destinationType: 'HOSPITAL',
    destinationName: 'Hospitali ya Taifa Muhimbili',
    scheduledAt: future(),
    contactPhone: '0712345678',
    mobilityNeeds: 'Anatumia kiti cha magurudumu',
    ...overrides,
  };
}

beforeAll(async () => {
  await register('client');
  await register('other');
  await register('nurseA', { role: 'STAFF', specialty: 'NURSE' });
  await register('nurseB', { role: 'STAFF', specialty: 'NURSE' });

  const admin = await request(app).post('/api/auth/login').send({ identifier: '0700000003', password: 'Password123!' });
  tokens.admin = admin.body.data.tokens.accessToken;

  for (const who of ['nurseA', 'nurseB']) {
    const me = await request(app).get('/api/staff/me').set(auth(who));
    staff[who] = me.body.data.staff.id;
    await request(app).patch(`/api/staff/${staff[who]}/approve`).set(auth('admin'));
  }

  const fam = await request(app).get('/api/family-members').set(auth('client'));
  familyMemberId = fam.body.data.familyMembers[0].id;
  const otherFam = await request(app).get('/api/family-members').set(auth('other'));
  otherFamilyMemberId = otherFam.body.data.familyMembers[0].id;

  serviceId = (await Service.findOne({ where: { category: 'Nursing', isActive: true } })).id;
});

afterAll(async () => {
  await User.destroy({ where: { phone: Object.values(phones) } });
  await sequelize.close();
});

describe('Care Mobility — staff availability', () => {
  it('lets a nurse set status, hours, base and areas, and refuses half a coordinate', async () => {
    const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ from: '00:00', to: '23:59' }]]));
    const ok = await request(app)
      .patch('/api/care/staff/availability')
      .set(auth('nurseA'))
      .send({ availability: 'AVAILABLE', workingHours: hours, serviceAreas: ['Mikocheni'], baseLat: -6.77, baseLng: 39.25 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.staff.workingHours.mon[0].from).toBe('00:00');

    const half = await request(app).patch('/api/care/staff/availability').set(auth('nurseB')).send({ baseLat: -6.7 });
    expect(half.status).toBe(400);

    const badHours = await request(app)
      .patch('/api/care/staff/availability')
      .set(auth('nurseB'))
      .send({ workingHours: { mon: [{ from: '17:00', to: '08:00' }] } });
    expect(badHours.status).toBe(400);

    await request(app).patch('/api/care/staff/availability').set(auth('nurseB')).send({ availability: 'OFFLINE' });
  });

  it('is STAFF only', async () => {
    const res = await request(app).patch('/api/care/staff/availability').set(auth('client')).send({ availability: 'AVAILABLE' });
    expect(res.status).toBe(403);
  });
});

describe('Care Mobility — home visit booking', () => {
  let bookingId;

  it('creates a booking with a readable reference, place details and a first history row', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(auth('client'))
      .send(
        booking({
          locationDetails: { house: 'Nyumba 14', floor: 'Ghorofa 2', landmark: 'Karibu na msikiti', contactInstructions: 'Piga simu ukifika getini' },
          accessibilityNotes: 'Ngazi tu, hakuna lifti',
          timeWindow: 'MORNING',
        })
      );
    expect(res.status).toBe(201);
    const b = res.body.data.booking;
    expect(b.bookingReference).toMatch(/^AN-[2-9A-HJKMNP-Z]{6}$/);
    expect(b.locationDetails.landmark).toBe('Karibu na msikiti');
    expect(b.serviceZoneId).toBeTruthy();
    bookingId = b.id;

    const rows = await StatusHistory.findAll({ where: { entityType: 'BOOKING', entityId: bookingId } });
    expect(rows.map((r) => r.toStatus)).toEqual(['REQUESTED']);
  });

  it('returns the same booking for the same idempotency key instead of making a second', async () => {
    const key = `test-${suffix}-idem`;
    const body = booking();
    const first = await request(app).post('/api/bookings').set(auth('client')).set('Idempotency-Key', key).send(body);
    const second = await request(app).post('/api/bookings').set(auth('client')).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.replayed).toBe(true);
    expect(second.body.data.booking.id).toBe(first.body.data.booking.id);
    expect(await Booking.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('refuses a pin outside every service zone, and accepts a typed address with no pin', async () => {
    const out = await request(app)
      .post('/api/bookings')
      .set(auth('client'))
      .send(booking({ locationLat: OUT_OF_ZONE.lat, locationLng: OUT_OF_ZONE.lng }));
    expect(out.status).toBe(422);
    expect(out.body.code).toBe('OUT_OF_SERVICE_AREA');

    const noPin = await request(app)
      .post('/api/bookings')
      .set(auth('client'))
      .send(booking({ locationLat: undefined, locationLng: undefined }));
    expect(noPin.status).toBe(201);
  });

  it('refuses a request too soon to dispatch, pointing at emergency care', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set(auth('client'))
      .send(booking({ scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('TOO_SOON');
    expect(res.body.message).toMatch(/112/);
  });

  it('lists it under Upcoming in My Care Requests, and nowhere for another client', async () => {
    const mine = await request(app).get('/api/care/requests?tab=upcoming').set(auth('client'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items.some((i) => i.id === bookingId && i.kind === 'HOME_VISIT')).toBe(true);
    expect(mine.body.data.counts.upcoming).toBeGreaterThan(0);

    const theirs = await request(app).get('/api/care/requests?tab=upcoming').set(auth('other'));
    expect(theirs.body.data.items.some((i) => i.id === bookingId)).toBe(false);
  });

  it('lets the owner track it and refuses another client (IDOR)', async () => {
    const own = await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('client'));
    expect(own.status).toBe(200);
    expect(own.body.data.timeline[0].toStatus).toBe('REQUESTED');
    // The client's timeline does not say which dispatcher did what.
    expect(own.body.data.timeline[0].actor).toBeUndefined();

    const other = await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('other'));
    expect(other.status).toBe(403);
  });
});

describe('Care Mobility — dispatch', () => {
  let bookingId;
  let clashId;

  beforeAll(async () => {
    const res = await request(app).post('/api/bookings').set(auth('client')).send(booking());
    bookingId = res.body.data.booking.id;
  });

  it('is ADMIN only', async () => {
    for (const who of ['client', 'nurseA']) {
      expect((await request(app).get('/api/dispatch/queue').set(auth(who))).status).toBe(403);
      expect((await request(app).post(`/api/dispatch/bookings/${bookingId}/assign`).set(auth(who)).send({ staffId: staff.nurseA })).status).toBe(403);
    }
  });

  it('shows the booking in the queue with ranked recommendations and their reasons', async () => {
    const q = await request(app).get('/api/dispatch/queue').set(auth('admin'));
    expect(q.status).toBe(200);
    expect(q.body.data.items.some((i) => i.id === bookingId)).toBe(true);

    const d = await request(app).get(`/api/dispatch/bookings/${bookingId}`).set(auth('admin'));
    expect(d.status).toBe(200);
    const a = d.body.data.recommendations.find((c) => c.id === staff.nurseA);
    const b = d.body.data.recommendations.find((c) => c.id === staff.nurseB);
    expect(a.eligible).toBe(true);
    expect(a.reasons).toEqual(expect.arrayContaining(['Yupo tayari sasa', 'Anahudumia eneo hili']));
    expect(a.distanceKm).not.toBeNull();
    expect(a.rank).toBeLessThan(b.rank);
  });

  it('marks it under review and tells the client', async () => {
    const res = await request(app).patch(`/api/bookings/${bookingId}/review`).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('UNDER_REVIEW');
  });

  it('requires a reason to override the recommendation, and audits it', async () => {
    const d = await request(app).get(`/api/dispatch/bookings/${bookingId}`).set(auth('admin'));
    const top = d.body.data.recommendations.find((c) => c.eligible);
    expect(top.id).not.toBe(staff.nurseB);

    const noReason = await request(app).post(`/api/dispatch/bookings/${bookingId}/assign`).set(auth('admin')).send({ staffId: staff.nurseB });
    expect(noReason.status).toBe(400);

    const withReason = await request(app)
      .post(`/api/dispatch/bookings/${bookingId}/assign`)
      .set(auth('admin'))
      .send({ staffId: staff.nurseB, overrideReason: 'Familia imemwomba yeye kwa jina' });
    expect(withReason.status).toBe(200);
    expect(withReason.body.data.booking.status).toBe('ASSIGNED');

    const audit = await AuditLog.findOne({ where: { action: 'BOOKING_ASSIGNED', entityId: bookingId } });
    expect(audit.metadata.followedRecommendation).toBe(false);
    expect(audit.metadata.overrideReason).toBe('Familia imemwomba yeye kwa jina');
  });

  it('refuses to double-book the same nurse at the same time, on every assign route', async () => {
    const at = (await Booking.findByPk(bookingId)).scheduledAt.toISOString();
    const res = await request(app).post('/api/bookings').set(auth('client')).send(booking({ scheduledAt: at }));
    clashId = res.body.data.booking.id;

    const legacy = await request(app).patch(`/api/bookings/${clashId}/assign`).set(auth('admin')).send({ staffId: staff.nurseB });
    expect(legacy.status).toBe(409);
    expect(legacy.body.code).toBe('SCHEDULE_CONFLICT');

    const viaDispatch = await request(app)
      .post(`/api/dispatch/bookings/${clashId}/assign`)
      .set(auth('admin'))
      .send({ staffId: staff.nurseB, overrideReason: 'Kujaribu' });
    expect(viaDispatch.status).toBe(409);

    // And the recommendation already said so.
    const d = await request(app).get(`/api/dispatch/bookings/${clashId}`).set(auth('admin'));
    const b = d.body.data.recommendations.find((c) => c.id === staff.nurseB);
    expect(b.eligible).toBe(false);
    expect(b.blockers.join(' ')).toMatch(/AN-/);
  });

  it('refuses a nurse who has marked herself away', async () => {
    await request(app)
      .patch('/api/care/staff/availability')
      .set(auth('nurseA'))
      .send({ unavailableUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() });

    const res = await request(app).patch(`/api/bookings/${clashId}/assign`).set(auth('admin')).send({ staffId: staff.nurseA });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STAFF_UNAVAILABLE');

    await request(app).patch('/api/care/staff/availability').set(auth('nurseA')).send({ unavailableUntil: null });
  });

  it('records a failed visit with its reason', async () => {
    const res = await request(app).patch(`/api/bookings/${bookingId}/fail`).set(auth('admin')).send({ reason: 'Muuguzi aliugua njiani' });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('FAILED');
    const cancelled = await request(app).get('/api/care/requests?tab=cancelled').set(auth('client'));
    expect(cancelled.body.data.items.some((i) => i.id === bookingId)).toBe(true);
  });

  it('expires a request nobody dispatched before its time passed', async () => {
    const res = await request(app).post('/api/bookings').set(auth('client')).send(booking());
    const id = res.body.data.booking.id;
    await Booking.update({ scheduledAt: new Date(Date.now() - 6 * 3600 * 1000) }, { where: { id } });

    await request(app).get('/api/dispatch/queue').set(auth('admin'));
    const after = await Booking.findByPk(id);
    expect(after.status).toBe('EXPIRED');
    const last = await StatusHistory.findOne({ where: { entityId: id }, order: [['createdAt', 'DESC']] });
    expect(last.toStatus).toBe('EXPIRED');
    expect(last.actorUserId).toBeNull();
  });
});

describe('Care Mobility — transport', () => {
  let tripId;

  it('stops a request that reads like an emergency and points at 112', async () => {
    const res = await request(app)
      .post('/api/transport')
      .set(auth('client'))
      .send(trip({ notes: 'Amepoteza fahamu na hapumui vizuri' }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('EMERGENCY_DETECTED');
    expect(res.body.message).toMatch(/112/);
  });

  it('creates a trip with an AT- reference, idempotently', async () => {
    const key = `trip-${suffix}-idem`;
    const body = trip();
    const res = await request(app).post('/api/transport').set(auth('client')).set('Idempotency-Key', key).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.trip.bookingReference).toMatch(/^AT-/);
    tripId = res.body.data.trip.id;

    const again = await request(app).post('/api/transport').set(auth('client')).set('Idempotency-Key', key).send(body);
    expect(again.status).toBe(200);
    expect(again.body.data.trip.id).toBe(tripId);
  });

  it("refuses a trip for somebody else's family member", async () => {
    const res = await request(app).post('/api/transport').set(auth('client')).send(trip({ familyMemberId: otherFamilyMemberId }));
    expect(res.status).toBe(404);
  });

  it('keeps the trip from other clients and from staff who are not driving it', async () => {
    expect((await request(app).get(`/api/transport/${tripId}`).set(auth('other'))).status).toBe(403);
    expect((await request(app).get(`/api/transport/${tripId}`).set(auth('nurseA'))).status).toBe(403);
    expect((await request(app).patch(`/api/transport/${tripId}/cancel`).set(auth('other')).send({ reason: 'Si yangu' })).status).toBe(403);
  });

  it('cannot be assigned before the client has accepted a fare', async () => {
    const res = await request(app)
      .patch(`/api/dispatch/transport/${tripId}/assign`)
      .set(auth('admin'))
      .send({ partnerName: 'Kampuni X', driverName: 'Juma' });
    expect(res.status).toBe(409);
  });

  it('goes quote -> accept -> assign, and never shows the driver phone to the client', async () => {
    const quote = await request(app).patch(`/api/dispatch/transport/${tripId}/quote`).set(auth('admin')).send({ fareTzs: 25000 });
    expect(quote.status).toBe(200);
    expect(quote.body.data.trip.status).toBe('QUOTED');

    const accepted = await request(app).patch(`/api/transport/${tripId}/accept-quote`).set(auth('client'));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.trip.confirmedFareTzs).toBe(25000);

    const assigned = await request(app)
      .patch(`/api/dispatch/transport/${tripId}/assign`)
      .set(auth('admin'))
      .send({ staffId: staff.nurseA, vehicleDetails: 'Toyota Noah · T 123 ABC' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.trip.status).toBe('ASSIGNED');

    const clientView = await request(app).get(`/api/transport/${tripId}`).set(auth('client'));
    expect(clientView.body.data.trip.driverPhone).toBeUndefined();
    expect(clientView.body.data.trip.partnerReference).toBeUndefined();
    expect(clientView.body.data.trip.driver.name).toBe('Care Mobility nurseA');
    expect(JSON.stringify(clientView.body)).not.toContain(phones.nurseA);
  });

  it('lets the staff driver move it along, but not the client', async () => {
    const byClient = await request(app).patch(`/api/transport/${tripId}/progress`).set(auth('client')).send({ action: 'enRoute' });
    expect(byClient.status).toBe(403);

    const byOtherNurse = await request(app).patch(`/api/transport/${tripId}/progress`).set(auth('nurseB')).send({ action: 'enRoute' });
    expect(byOtherNurse.status).toBe(403);

    for (const action of ['enRoute', 'arrivedPickup', 'startTrip', 'arrivedDestination', 'complete']) {
      const res = await request(app).patch(`/api/transport/${tripId}/progress`).set(auth('nurseA')).send({ action });
      expect(res.status).toBe(200);
    }
    const skip = await request(app).patch(`/api/transport/${tripId}/progress`).set(auth('nurseA')).send({ action: 'enRoute' });
    expect(skip.status).toBe(409);

    const tracked = await request(app).get(`/api/care/requests/transport/${tripId}`).set(auth('client'));
    expect(tracked.body.data.timeline.map((t) => t.toStatus)).toEqual([
      'REQUESTED',
      'QUOTED',
      'ACCEPTED',
      'ASSIGNED',
      'EN_ROUTE',
      'ARRIVED_PICKUP',
      'IN_TRIP',
      'ARRIVED_DESTINATION',
      'COMPLETED',
    ]);
  });

  it('lets the client decline a fare, which cancels the request', async () => {
    const created = await request(app).post('/api/transport').set(auth('client')).send(trip());
    const id = created.body.data.trip.id;
    await request(app).patch(`/api/dispatch/transport/${id}/quote`).set(auth('admin')).send({ fareTzs: 90000 });
    const res = await request(app).patch(`/api/transport/${id}/decline-quote`).set(auth('client')).send({ reason: 'Bei ni kubwa' });
    expect(res.status).toBe(200);
    expect(res.body.data.trip.status).toBe('CANCELLED');
  });

  it('reports the partner integration as not configured, and never fakes a partner booking', async () => {
    const integ = await request(app).get('/api/dispatch/integrations').set(auth('admin'));
    expect(integ.body.data.transportPartner.configured).toBe(false);
    expect(integ.body.data.maps.routing).toBe(false);
    expect(integ.body.data.payments.online).toBe(false);

    const created = await request(app).post('/api/transport').set(auth('client')).send(trip());
    const id = created.body.data.trip.id;
    await request(app).patch(`/api/dispatch/transport/${id}/quote`).set(auth('admin')).send({ fareTzs: 20000 });
    await request(app).patch(`/api/transport/${id}/accept-quote`).set(auth('client'));
    const viaApi = await request(app).patch(`/api/dispatch/transport/${id}/assign`).set(auth('admin')).send({ usePartnerApi: true });
    expect(viaApi.status).toBe(502);
    expect(viaApi.body.code).toBe('PARTNER_NOT_CONFIGURED');
  });
});

describe('Care Mobility — transport partner webhook', () => {
  const sign = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('hex');
  const saved = {};

  beforeAll(() => {
    ['TRANSPORT_WEBHOOK_SECRET', 'TRANSPORT_PARTNER', 'TRANSPORT_PARTNER_BASE_URL', 'TRANSPORT_PARTNER_API_KEY'].forEach((k) => {
      saved[k] = process.env[k];
    });
  });
  afterAll(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it('answers 503 until a secret is configured', async () => {
    delete process.env.TRANSPORT_WEBHOOK_SECRET;
    const res = await request(app).post('/api/integrations/transport/webhook').send({ tripId: 'x', status: 'completed' });
    expect(res.status).toBe(503);
  });

  it('refuses a missing or wrong signature', async () => {
    process.env.TRANSPORT_WEBHOOK_SECRET = 'test-secret-not-real';
    const body = JSON.stringify({ tripId: 'x', status: 'completed' });
    const none = await request(app).post('/api/integrations/transport/webhook').set('Content-Type', 'application/json').send(body);
    expect(none.status).toBe(401);
    const wrong = await request(app)
      .post('/api/integrations/transport/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', sign(body, 'some-other-secret'))
      .send(body);
    expect(wrong.status).toBe(401);
  });

  it('accepts a signed callback only once a partner adapter is configured, and ignores what it cannot map', async () => {
    process.env.TRANSPORT_WEBHOOK_SECRET = 'test-secret-not-real';
    const body = JSON.stringify({ tripId: 'no-such-trip', status: 'completed' });
    const headers = { 'Content-Type': 'application/json', 'X-Signature': `sha256=${sign(body, 'test-secret-not-real')}` };

    delete process.env.TRANSPORT_PARTNER;
    const noAdapter = await request(app).post('/api/integrations/transport/webhook').set(headers).send(body);
    expect(noAdapter.status).toBe(503);

    process.env.TRANSPORT_PARTNER = 'partner';
    process.env.TRANSPORT_PARTNER_BASE_URL = 'https://partner.invalid';
    process.env.TRANSPORT_PARTNER_API_KEY = 'not-a-real-key';
    const res = await request(app).post('/api/integrations/transport/webhook').set(headers).send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(false);
    expect(res.body.data.reason).toBe('UNKNOWN_TRIP');
  });
});

describe('Care Mobility — discovery and settings', () => {
  it('describes coverage at an approximate location, and outside it', async () => {
    const inside = await request(app).get(`/api/care/discover?lat=${IN_ZONE.lat + 0.001234}&lng=${IN_ZONE.lng}`).set(auth('client'));
    expect(inside.status).toBe(200);
    expect(inside.body.data.coverage).toBe('COVERED');
    expect(inside.body.data.location.lat).toBe(-6.8);
    expect(inside.body.data.homeVisits.services.length).toBeGreaterThan(0);
    // No nurse is located on a client's screen.
    expect(JSON.stringify(inside.body)).not.toMatch(/baseLat|base_lat/);

    const outside = await request(app).get(`/api/care/discover?lat=${OUT_OF_ZONE.lat}&lng=${OUT_OF_ZONE.lng}`).set(auth('client'));
    expect(outside.body.data.coverage).toBe('OUTSIDE');
    expect(outside.body.data.homeVisits.available).toBe(false);
  });

  it('lets only an admin change settings, only known keys, only valid values', async () => {
    expect((await request(app).patch('/api/dispatch/settings').set(auth('client')).send({ 'booking.minLeadMinutes': 0 })).status).toBe(403);
    expect((await request(app).patch('/api/dispatch/settings').set(auth('admin')).send({ 'made.up': 1 })).status).toBe(400);
    expect((await request(app).patch('/api/dispatch/settings').set(auth('admin')).send({ 'booking.minLeadMinutes': -5 })).status).toBe(400);

    const ok = await request(app).patch('/api/dispatch/settings').set(auth('admin')).send({ 'dispatch.travelBufferMinutes': 45 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.settings['dispatch.travelBufferMinutes'].value).toBe(45);
    await AppSetting.destroy({ where: { key: 'dispatch.travelBufferMinutes' } });
  });

  it('computes analytics from real rows', async () => {
    const res = await request(app).get('/api/dispatch/analytics').set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.homeVisits.total).toBeGreaterThan(0);
    expect(res.body.data.dispatch.overrodeRecommendation).toBeGreaterThan(0);
  });
});
