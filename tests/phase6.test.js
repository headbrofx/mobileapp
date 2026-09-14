'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff, Service, Visit } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0722${suffix}`;
const otherClientPhone = `0723${suffix}`;
const staffPhone = `0724${suffix}`;
const otherStaffPhone = `0725${suffix}`;

let clientToken;
let otherClientToken;
let staffToken;
let otherStaffToken;
let adminToken;
let familyMemberId;
let staffId;
let otherStaffId;
let nursingServiceId;

function future(hours = 48) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function createAssignedAcceptedBooking() {
  const create = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      familyMemberId,
      serviceId: nursingServiceId,
      locationAddress: 'Upanga, Dar es Salaam',
      scheduledAt: future(),
    });
  const bookingId = create.body.data.booking.id;

  await request(app)
    .patch(`/api/bookings/${bookingId}/assign`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ staffId });

  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${staffToken}`);

  return bookingId;
}

async function advanceToArrived(bookingId) {
  await request(app).patch(`/api/bookings/${bookingId}/on-the-way`).set('Authorization', `Bearer ${staffToken}`);
  await request(app).patch(`/api/bookings/${bookingId}/arrive`).set('Authorization', `Bearer ${staffToken}`);
}

afterAll(async () => {
  // Visits intentionally RESTRICT deleting the staff_profiles row they
  // reference (clinical records shouldn't vanish because a staff account
  // is removed) — clear this test's Visit rows first so cascading the
  // Staff/User cleanup below doesn't hit that guard.
  await Visit.destroy({ where: { staffId: [staffId, otherStaffId] } });
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone, staffPhone, otherStaffPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const clientReg = await request(app).post('/api/auth/register').send({
    name: 'Clinical Workflow Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = clientReg.body.data.tokens.accessToken;

  const familyList = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = familyList.body.data.familyMembers[0].id;

  const otherReg = await request(app).post('/api/auth/register').send({
    name: 'Other Clinical Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherReg.body.data.tokens.accessToken;

  const staffReg = await request(app).post('/api/auth/register').send({
    name: 'Clinical Workflow Test Nurse',
    phone: staffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  staffToken = staffReg.body.data.tokens.accessToken;

  const otherStaffReg = await request(app).post('/api/auth/register').send({
    name: 'Unassigned Nurse',
    phone: otherStaffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  otherStaffToken = otherStaffReg.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  const myStaffProfile = await request(app)
    .get('/api/staff/me')
    .set('Authorization', `Bearer ${staffToken}`);
  staffId = myStaffProfile.body.data.staff.id;

  const otherStaffProfile = await request(app)
    .get('/api/staff/me')
    .set('Authorization', `Bearer ${otherStaffToken}`);
  otherStaffId = otherStaffProfile.body.data.staff.id;

  await request(app).patch(`/api/staff/${staffId}/approve`).set('Authorization', `Bearer ${adminToken}`);
  await request(app).patch(`/api/staff/${otherStaffId}/approve`).set('Authorization', `Bearer ${adminToken}`);

  await Staff.update(
    { availability: 'AVAILABLE', serviceAreas: ['Upanga'] },
    { where: { id: [staffId, otherStaffId] } }
  );

  const nursingService = await Service.findOne({ where: { category: 'Nursing' } });
  nursingServiceId = nursingService.id;
});

describe('Phase 6 — Staff self-service', () => {
  it('lets a staff member update their own profile and availability', async () => {
    const res = await request(app)
      .patch('/api/staff/me')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ bio: 'Experienced home-care nurse', yearsExperience: 6, availability: 'AVAILABLE' });
    expect(res.status).toBe(200);
    expect(res.body.data.staff.bio).toBe('Experienced home-care nurse');
    expect(res.body.data.staff.yearsExperience).toBe(6);
  });

  it('blocks a client from touching the staff self-service endpoints', async () => {
    const res = await request(app)
      .patch('/api/staff/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ bio: 'nope' });
    expect(res.status).toBe(403);

    const schedule = await request(app)
      .get('/api/staff/me/schedule')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(schedule.status).toBe(403);
  });

  it("shows an assigned booking on the staff member's schedule", async () => {
    const bookingId = await createAssignedAcceptedBooking();

    const schedule = await request(app)
      .get('/api/staff/me/schedule')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(schedule.status).toBe(200);
    expect(schedule.body.data.bookings.some((b) => b.id === bookingId)).toBe(true);
  });
});

describe('Phase 6 — Visit clinical workflow', () => {
  it('has no visit record before check-in', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    const res = await request(app)
      .get(`/api/bookings/${bookingId}/visit`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });

  it('refuses check-in before the staff member has arrived', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(409);
  });

  it('blocks the unassigned staff member and a client from checking in', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    await advanceToArrived(bookingId);

    const asOtherStaff = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-in`)
      .set('Authorization', `Bearer ${otherStaffToken}`);
    expect(asOtherStaff.status).toBe(403);

    const asClient = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-in`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);
  });

  it('walks a full visit: check-in -> record vitals & notes -> check-out, completing the booking', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    await advanceToArrived(bookingId);

    const checkIn = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(checkIn.status).toBe(201);
    expect(checkIn.body.data.visit.checkInAt).toBeTruthy();
    expect(checkIn.body.data.visit.checkOutAt).toBeNull();

    const booking = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(booking.body.data.booking.status).toBe('IN_PROGRESS');

    const doubleCheckIn = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-in`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(doubleCheckIn.status).toBe(409);

    const update = await request(app)
      .patch(`/api/bookings/${bookingId}/visit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        assessment: 'Patient stable, wound healing well',
        treatmentNotes: 'Redressed wound, changed bandage',
        recommendations: 'Continue oral antibiotics, follow up in 5 days',
        followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        vitals: [
          { type: 'BLOOD_PRESSURE', systolic: 128, diastolic: 82, unit: 'mmHg' },
          { type: 'WEIGHT', value: 71.5, unit: 'kg' },
        ],
      });
    expect(update.status).toBe(200);
    expect(update.body.data.visit.assessment).toMatch(/wound healing well/);
    expect(update.body.data.visit.vitalsSnapshot.length).toBe(2);

    const vitalsList = await request(app)
      .get(`/api/family-members/${familyMemberId}/vitals`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(vitalsList.body.data.measurements.some((m) => m.type === 'WEIGHT' && m.value === 71.5)).toBe(true);

    const checkOut = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(checkOut.status).toBe(200);
    expect(checkOut.body.data.visit.checkOutAt).toBeTruthy();

    const completedBooking = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(completedBooking.body.data.booking.status).toBe('COMPLETED');

    const doubleCheckOut = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(doubleCheckOut.status).toBe(409);

    const updateAfterCheckOut = await request(app)
      .patch(`/api/bookings/${bookingId}/visit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ recommendations: 'too late' });
    expect(updateAfterCheckOut.status).toBe(409);

    const timeline = await request(app)
      .get(`/api/family-members/${familyMemberId}/timeline`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(timeline.body.data.events.some((e) => e.type === 'VISIT')).toBe(true);

    const schedule = await request(app)
      .get('/api/staff/me/schedule')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(schedule.body.data.bookings.some((b) => b.id === bookingId)).toBe(false);

    const completedSchedule = await request(app)
      .get('/api/staff/me/schedule?status=COMPLETED')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(completedSchedule.body.data.bookings.some((b) => b.id === bookingId)).toBe(true);
  });

  it('requires an assessment before check-out if none was ever recorded', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    await advanceToArrived(bookingId);
    await request(app).post(`/api/bookings/${bookingId}/visit/check-in`).set('Authorization', `Bearer ${staffToken}`);

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/visit/check-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('blocks a non-participant client from viewing the visit record', async () => {
    const bookingId = await createAssignedAcceptedBooking();
    await advanceToArrived(bookingId);
    await request(app).post(`/api/bookings/${bookingId}/visit/check-in`).set('Authorization', `Bearer ${staffToken}`);

    const res = await request(app)
      .get(`/api/bookings/${bookingId}/visit`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(res.status).toBe(403);
  });
});
