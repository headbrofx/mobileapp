'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff, Service, Booking } = require('../src/models');

// Where a visit report is written, who can read it, and how the office
// finds it again.

const suffix = Date.now().toString().slice(-6);
const phones = { client: `0771${suffix}`, other: `0772${suffix}`, nurse: `0773${suffix}` };
const tokens = {};
let staffId;
let bookingId;
let reference;
const patientName = `Bibi Report ${suffix}`;

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  for (const [who, extra] of [['client', {}], ['other', {}], ['nurse', { role: 'STAFF', specialty: 'NURSE' }]]) {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: `Visit Report ${who}`, phone: phones[who], password: 'TestPass123', ...extra });
    tokens[who] = res.body.data.tokens.accessToken;
  }
  const admin = await request(app).post('/api/auth/login').send({ identifier: '0700000003', password: 'Password123!' });
  tokens.admin = admin.body.data.tokens.accessToken;

  const me = await request(app).get('/api/staff/me').set(auth('nurse'));
  staffId = me.body.data.staff.id;
  await request(app).patch(`/api/staff/${staffId}/approve`).set(auth('admin'));
  await Staff.update({ availability: 'AVAILABLE', baseLat: -6.77, baseLng: 39.25, licenseNumber: 'TNMC-SECRET' }, { where: { id: staffId } });

  const member = await request(app)
    .post('/api/family-members')
    .set(auth('client'))
    .send({ name: patientName, relationship: 'PARENT' });
  const familyMemberId = member.body.data.familyMember.id;

  const service = await Service.findOne({ where: { category: 'Nursing', isActive: true } });
  const created = await request(app)
    .post('/api/bookings')
    .set(auth('client'))
    .send({
      familyMemberId,
      serviceId: service.id,
      locationAddress: 'Mbezi Beach, Dar es Salaam',
      scheduledAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });
  bookingId = created.body.data.booking.id;
  reference = created.body.data.booking.bookingReference;

  await request(app).patch(`/api/bookings/${bookingId}/assign`).set(auth('admin')).send({ staffId });
  for (const action of ['accept', 'on-the-way', 'arrive']) {
    await request(app).patch(`/api/bookings/${bookingId}/${action}`).set(auth('nurse'));
  }
});

afterAll(async () => {
  await Booking.destroy({ where: { id: bookingId } });
  await User.destroy({ where: { phone: Object.values(phones) } });
  await sequelize.close();
});

describe('Visit reports', () => {
  it('lets the nurse check in, record vitals and notes, and close with an assessment', async () => {
    const start = await request(app).post(`/api/bookings/${bookingId}/visit/check-in`).set(auth('nurse'));
    expect(start.status).toBe(201);

    const draft = await request(app)
      .patch(`/api/bookings/${bookingId}/visit`)
      .set(auth('nurse'))
      .send({
        treatmentNotes: 'Kidonda kimesafishwa na kufungwa upya.',
        recommendations: 'Kunywa maji mengi, kidonda kisilowe.',
        followUpDate: '2027-01-15',
        vitals: [
          { type: 'BLOOD_PRESSURE', systolic: 128, diastolic: 82, unit: 'mmHg' },
          { type: 'TEMPERATURE', value: 36.8, unit: '°C' },
        ],
      });
    expect(draft.status).toBe(200);

    const noAssessment = await request(app).post(`/api/bookings/${bookingId}/visit/check-out`).set(auth('nurse')).send({});
    expect(noAssessment.status).toBe(400);

    const done = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-out`)
      .set(auth('nurse'))
      .send({ assessment: 'Kidonda kinapona vizuri, hakuna dalili za maambukizi.' });
    expect(done.status).toBe(200);
  });

  it('shows the finished report to the client on the tracking screen', async () => {
    const res = await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('client'));
    expect(res.status).toBe(200);
    const report = res.body.data.report;
    expect(report.status).toBe('FINAL');
    expect(report.reference).toBe(reference);
    expect(report.patient.name).toBe(patientName);
    expect(report.assessment).toMatch(/inapona/);
    expect(report.vitals.map((v) => v.summary)).toEqual(expect.arrayContaining(['128/82 mmHg']));
    expect(report.nurse.name).toBe('Visit Report nurse');
  });

  it("never sends the nurse's base location, licence or phone to the client", async () => {
    const tracked = await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('client'));
    const raw = await request(app).get(`/api/bookings/${bookingId}/visit`).set(auth('client'));
    for (const body of [JSON.stringify(tracked.body), JSON.stringify(raw.body)]) {
      expect(body).not.toContain('TNMC-SECRET');
      expect(body).not.toContain('baseLat');
      expect(body).not.toContain(phones.nurse);
    }
  });

  it('keeps the report from another client', async () => {
    expect((await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('other'))).status).toBe(403);
    expect((await request(app).get(`/api/bookings/${bookingId}/visit`).set(auth('other'))).status).toBe(403);
  });

  it('lets the office find it by patient name or reference, and nobody else list them', async () => {
    const byName = await request(app).get(`/api/admin/visits?q=${encodeURIComponent('Report ' + suffix)}`).set(auth('admin'));
    expect(byName.status).toBe(200);
    expect(byName.body.data.reports.map((r) => r.bookingId)).toContain(bookingId);

    const byRef = await request(app).get(`/api/admin/visits?q=${reference}`).set(auth('admin'));
    expect(byRef.body.data.reports).toHaveLength(1);

    expect((await request(app).get('/api/admin/visits').set(auth('client'))).status).toBe(403);
    expect((await request(app).get('/api/admin/visits').set(auth('nurse'))).status).toBe(403);
  });

  it('keeps the vitals in the patient\'s own health record too', async () => {
    const res = await request(app).get(`/api/care/requests/home-visit/${bookingId}`).set(auth('client'));
    const patientId = res.body.data.report.patient.id;
    const vitals = await request(app).get(`/api/family-members/${patientId}/vitals`).set(auth('client'));
    expect(vitals.status).toBe(200);
    const list = vitals.body.data.measurements ?? vitals.body.data.vitals ?? [];
    expect(list.some((m) => m.systolic === 128)).toBe(true);
  });
});
