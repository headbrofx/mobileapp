'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff, Service } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0731${suffix}`;
const otherClientPhone = `0732${suffix}`;
const staffPhone = `0733${suffix}`;
const otherStaffPhone = `0734${suffix}`;

let clientToken;
let otherClientToken;
let staffToken;
let otherStaffToken;
let adminToken;
let familyMemberId;
let staffId;
let nursingServiceId;

// Destination: a point in Masaki, Dar es Salaam.
const DEST_LAT = -6.7730;
const DEST_LNG = 39.2726;
// A few km away.
const FAR_LAT = -6.8000;
const FAR_LNG = 39.29;

function future(hours = 48) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function createBookingOnTheWay({ withDestination = true } = {}) {
  const create = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      familyMemberId,
      serviceId: nursingServiceId,
      locationAddress: 'Masaki, Dar es Salaam',
      ...(withDestination ? { locationLat: DEST_LAT, locationLng: DEST_LNG } : {}),
      scheduledAt: future(),
    });
  const bookingId = create.body.data.booking.id;

  await request(app)
    .patch(`/api/bookings/${bookingId}/assign`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ staffId });
  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${staffToken}`);
  await request(app).patch(`/api/bookings/${bookingId}/on-the-way`).set('Authorization', `Bearer ${staffToken}`);

  return bookingId;
}

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone, staffPhone, otherStaffPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const clientReg = await request(app).post('/api/auth/register').send({
    name: 'Location Tracking Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = clientReg.body.data.tokens.accessToken;

  const familyList = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = familyList.body.data.familyMembers[0].id;

  const otherReg = await request(app).post('/api/auth/register').send({
    name: 'Other Location Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherReg.body.data.tokens.accessToken;

  const staffReg = await request(app).post('/api/auth/register').send({
    name: 'Location Tracking Test Nurse',
    phone: staffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  staffToken = staffReg.body.data.tokens.accessToken;

  const otherStaffReg = await request(app).post('/api/auth/register').send({
    name: 'Unassigned Nurse (Phase 7)',
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

  await request(app).patch(`/api/staff/${staffId}/approve`).set('Authorization', `Bearer ${adminToken}`);
  await Staff.update({ availability: 'AVAILABLE', serviceAreas: ['Masaki'] }, { where: { id: staffId } });

  const nursingService = await Service.findOne({ where: { category: 'Nursing' } });
  nursingServiceId = nursingService.id;
});

describe('Phase 7 — Recording location pings', () => {
  it('refuses a ping before the booking is on the way', async () => {
    const create = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        familyMemberId,
        serviceId: nursingServiceId,
        locationAddress: 'Masaki',
        locationLat: DEST_LAT,
        locationLng: DEST_LNG,
        scheduledAt: future(),
      });
    const bookingId = create.body.data.booking.id;
    await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffId });
    await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${staffToken}`);

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });
    expect(res.status).toBe(409);
  });

  it('blocks an unassigned staff member and a client from recording a ping', async () => {
    const bookingId = await createBookingOnTheWay();

    const asOtherStaff = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${otherStaffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });
    expect(asOtherStaff.status).toBe(403);

    const asClient = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });
    expect(asClient.status).toBe(403);
  });

  it('rejects out-of-range coordinates', async () => {
    const bookingId = await createBookingOnTheWay();
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: 200, lng: 39 });
    expect(res.status).toBe(400);
  });
});

describe('Phase 7 — Current location, distance/ETA/proximity, and history', () => {
  it('has no location before any ping is recorded', async () => {
    const bookingId = await createBookingOnTheWay();
    const res = await request(app)
      .get(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hasLocation).toBe(false);
  });

  it('reports distance/ETA/proximity once pings come in, moving from EN_ROUTE to ARRIVING_SOON', async () => {
    const bookingId = await createBookingOnTheWay();

    const farPing = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });
    expect(farPing.status).toBe(201);

    const farStatus = await request(app)
      .get(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(farStatus.status).toBe(200);
    expect(farStatus.body.data.hasLocation).toBe(true);
    expect(farStatus.body.data.distanceKm).toBeGreaterThan(1);
    expect(farStatus.body.data.etaMinutes).toBeGreaterThan(0);
    expect(farStatus.body.data.proximity).toBe('EN_ROUTE');
    expect(farStatus.body.data.stale).toBe(false);

    const closePing = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: DEST_LAT, lng: DEST_LNG });
    expect(closePing.status).toBe(201);

    const closeStatus = await request(app)
      .get(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(closeStatus.body.data.distanceKm).toBeLessThan(0.3);
    expect(closeStatus.body.data.proximity).toBe('ARRIVING_SOON');

    const history = await request(app)
      .get(`/api/bookings/${bookingId}/location/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(history.status).toBe(200);
    expect(history.body.data.pings.length).toBe(2);
    expect(history.body.data.pings[0].lat).toBeCloseTo(FAR_LAT);
    expect(history.body.data.pings[1].lat).toBeCloseTo(DEST_LAT);
  });

  it('has a location but no distance/ETA when the booking has no destination coordinates', async () => {
    const bookingId = await createBookingOnTheWay({ withDestination: false });
    await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });

    const res = await request(app)
      .get(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.body.data.hasLocation).toBe(true);
    expect(res.body.data.distanceKm).toBeNull();
    expect(res.body.data.etaMinutes).toBeNull();
    expect(res.body.data.proximity).toBeNull();
  });

  it('stops accepting pings once the staff member has arrived', async () => {
    const bookingId = await createBookingOnTheWay();
    await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });

    await request(app).patch(`/api/bookings/${bookingId}/arrive`).set('Authorization', `Bearer ${staffToken}`);

    const res = await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: DEST_LAT, lng: DEST_LNG });
    expect(res.status).toBe(409);
  });

  it('blocks a non-participant client from viewing location or history', async () => {
    const bookingId = await createBookingOnTheWay();
    await request(app)
      .post(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ lat: FAR_LAT, lng: FAR_LNG });

    const current = await request(app)
      .get(`/api/bookings/${bookingId}/location`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(current.status).toBe(403);

    const history = await request(app)
      .get(`/api/bookings/${bookingId}/location/history`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(history.status).toBe(403);
  });
});
