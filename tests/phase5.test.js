'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff, Service } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0712${suffix}`;
const otherClientPhone = `0713${suffix}`;
const staffPhone = `0714${suffix}`;

let clientToken;
let otherClientToken;
let staffToken;
let adminToken;
let familyMemberId;
let staffId;
let nursingServiceId;

function future(hours = 48) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone, staffPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const clientReg = await request(app).post('/api/auth/register').send({
    name: 'Booking Engine Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = clientReg.body.data.tokens.accessToken;

  const familyList = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = familyList.body.data.familyMembers[0].id;

  const otherReg = await request(app).post('/api/auth/register').send({
    name: 'Other Booking Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherReg.body.data.tokens.accessToken;

  const staffReg = await request(app).post('/api/auth/register').send({
    name: 'Booking Engine Test Nurse',
    phone: staffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  staffToken = staffReg.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  const myStaffProfile = await request(app)
    .get('/api/staff/me')
    .set('Authorization', `Bearer ${staffToken}`);
  staffId = myStaffProfile.body.data.staff.id;

  await request(app)
    .patch(`/api/staff/${staffId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  // No "update my availability" endpoint yet (Phase 6 territory) — set it
  // directly so the suggested-staff matcher has an AVAILABLE candidate.
  await Staff.update(
    { availability: 'AVAILABLE', serviceAreas: ['Kinondoni', 'Dar es Salaam'] },
    { where: { id: staffId } }
  );

  const nursingService = await Service.findOne({ where: { category: 'Nursing' } });
  nursingServiceId = nursingService.id;
});

describe('Phase 5 — Booking creation & access control', () => {
  let bookingId;

  it('lets a client create a booking for their own family member', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni, Dar es Salaam',
        scheduledAt: future(),
        notes: 'Wound dressing change',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('REQUESTED');
    bookingId = res.body.data.booking.id;
  });

  it('rejects a booking with a family member that is not the client\'s own', async () => {
    const otherFamilyList = await request(app)
      .get('/api/family-members')
      .set('Authorization', `Bearer ${otherClientToken}`);
    const otherFamilyMemberId = otherFamilyList.body.data.familyMembers[0].id;

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId: otherFamilyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    expect(res.status).toBe(404);
  });

  it('rejects a booking scheduled in the past', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it('blocks another client from viewing this booking', async () => {
    const res = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(res.status).toBe(403);
  });

  it('lets the owning client view their booking', async () => {
    const res = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.booking.id).toBe(bookingId);
  });

  it('scopes the list endpoint by role', async () => {
    const asClient = await request(app).get('/api/bookings').set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.body.data.bookings.some((b) => b.id === bookingId)).toBe(true);

    const asOtherClient = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(asOtherClient.body.data.bookings.some((b) => b.id === bookingId)).toBe(false);
  });
});

describe('Phase 5 — Suggested staff matching', () => {
  it('suggests the approved, available nurse whose service area matches the booking location', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni, Dar es Salaam',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    const res = await request(app)
      .get(`/api/bookings/${bookingId}/suggested-staff`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const match = res.body.data.candidates.find((c) => c.id === staffId);
    expect(match).toBeDefined();
    expect(match.areaMatch).toBe(true);
  });

  it('blocks a non-admin from viewing suggested staff', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    const res = await request(app)
      .get(`/api/bookings/${bookingId}/suggested-staff`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Phase 5 — Full lifecycle transitions', () => {
  let bookingId;

  beforeAll(async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni, Dar es Salaam',
        scheduledAt: future(),
      });
    bookingId = create.body.data.booking.id;
  });

  it('rejects the staff acting before they are assigned', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('walks a booking through assign -> accept -> on-the-way -> arrive -> start -> complete', async () => {
    const assign = await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });
    expect(assign.status).toBe(200);
    expect(assign.body.data.booking.status).toBe('ASSIGNED');

    const doubleAssign = await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });
    expect(doubleAssign.status).toBe(409);

    const client = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(client.status).toBe(403);

    const accept = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.booking.status).toBe('ACCEPTED');

    const onTheWay = await request(app)
      .patch(`/api/bookings/${bookingId}/on-the-way`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(onTheWay.status).toBe(200);
    expect(onTheWay.body.data.booking.status).toBe('ON_THE_WAY');

    const arrive = await request(app)
      .patch(`/api/bookings/${bookingId}/arrive`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(arrive.status).toBe(200);
    expect(arrive.body.data.booking.status).toBe('ARRIVED');

    const start = await request(app)
      .patch(`/api/bookings/${bookingId}/start`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(start.status).toBe(200);
    expect(start.body.data.booking.status).toBe('IN_PROGRESS');

    const complete = await request(app)
      .patch(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(complete.status).toBe(200);
    expect(complete.body.data.booking.status).toBe('COMPLETED');

    const cancelAfterComplete = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'Changed my mind' });
    expect(cancelAfterComplete.status).toBe(409);
  });
});

describe('Phase 5 — Reject, reassign, reschedule, cancel', () => {
  it('lets the assigned staff reject a booking, freeing it for reassignment', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });

    const reject = await request(app)
      .patch(`/api/bookings/${bookingId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Fully booked that day' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.booking.status).toBe('REJECTED');
    expect(reject.body.data.booking.staffId).toBeNull();

    const reassign = await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });
    expect(reassign.status).toBe(200);
    expect(reassign.body.data.booking.status).toBe('ASSIGNED');
  });

  it('lets the client reschedule a pending booking, clearing any assignment', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });

    const newTime = future(96);
    const reschedule = await request(app)
      .patch(`/api/bookings/${bookingId}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ scheduledAt: newTime });
    expect(reschedule.status).toBe(200);
    expect(reschedule.body.data.booking.status).toBe('RESCHEDULED');
    expect(reschedule.body.data.booking.staffId).toBeNull();

    const reassign = await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });
    expect(reassign.status).toBe(200);
  });

  it('lets the client cancel a booking with a reason, and rejects cancellation without one', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    const missingReason = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(missingReason.status).toBe(400);

    const cancel = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'No longer needed' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.booking.status).toBe('CANCELLED');
    expect(cancel.body.data.booking.cancellationReason).toBe('No longer needed');
  });

  it('blocks another client from cancelling this client\'s booking', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Kinondoni',
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({ reason: 'Not mine to cancel' });
    expect(res.status).toBe(403);
  });
});
