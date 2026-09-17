'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff, Notification } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0721${suffix}`;
const otherPhone = `0722${suffix}`;
const staffPhone = `0723${suffix}`;

let clientToken;
let otherToken;
let adminToken;
let staffToken;
let staffId;
let familyMemberId;
let serviceId;
let bookingId;

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherPhone, staffPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Notification Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const other = await request(app).post('/api/auth/register').send({
    name: 'Notification Other Client',
    phone: otherPhone,
    password: 'TestPass123',
  });
  otherToken = other.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // A nurse of this test's own. The seeded 0700000002 account is a
  // STAFF user with no Staff profile behind it, so /api/staff/me has
  // nothing to return for it.
  const staffReg = await request(app).post('/api/auth/register').send({
    name: 'Notification Test Nurse',
    phone: staffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  staffToken = staffReg.body.data.tokens.accessToken;

  const mine = await request(app)
    .get('/api/family-members')
    .set({ Authorization: `Bearer ${clientToken}` });
  familyMemberId = mine.body.data.familyMembers[0].id;

  const services = await request(app)
    .get('/api/services')
    .set({ Authorization: `Bearer ${clientToken}` });
  serviceId = services.body.data.services[0].id;

  const staffProfile = await request(app)
    .get('/api/staff/me')
    .set({ Authorization: `Bearer ${staffToken}` });
  staffId = staffProfile.body.data.staff.id;

  await request(app).patch(`/api/staff/${staffId}/approve`).set({ Authorization: `Bearer ${adminToken}` });
  await Staff.update({ availability: 'AVAILABLE' }, { where: { id: staffId } });
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Notifications', () => {
  it('starts empty for a new account', async () => {
    const res = await request(app).get('/api/notifications').set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.unread).toBe(0);
  });

  it('says nothing about the things the client did themselves', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set(auth(clientToken))
      .send({
        familyMemberId,
        serviceId,
        locationAddress: 'Kariakoo, Dar es Salaam',
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });
    expect(created.status).toBe(201);
    bookingId = created.body.data.booking.id;

    // Nobody needs telling about the thing they just pressed a button
    // to do.
    const res = await request(app).get('/api/notifications').set(auth(clientToken));
    expect(res.body.data.unread).toBe(0);
  });

  it('tells the client when somebody else moves their booking along', async () => {
    await request(app)
      .patch(`/api/bookings/${bookingId}/assign`)
      .set(auth(adminToken))
      .send({ staffId });

    await request(app).patch(`/api/bookings/${bookingId}/accept`).set(auth(staffToken));

    const res = await request(app).get('/api/notifications').set(auth(clientToken));
    expect(res.body.data.unread).toBe(2);

    const titles = res.body.data.notifications.map((n) => n.title);
    expect(titles).toContain('Muuguzi amepangiwa');
    expect(titles).toContain('Muuguzi amekubali');

    // Each carries the booking it is about, so tapping one can open it.
    expect(res.body.data.notifications[0].data.bookingId).toBe(bookingId);
  });

  it('keeps one client out of another client’s notifications', async () => {
    const res = await request(app).get('/api/notifications').set(auth(otherToken));
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.unread).toBe(0);
  });

  it('marks one as read', async () => {
    const list = await request(app).get('/api/notifications').set(auth(clientToken));
    const target = list.body.data.notifications[0].id;

    const res = await request(app)
      .post(`/api/notifications/${target}/read`)
      .set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.data.notification.status).toBe('READ');

    const after = await request(app).get('/api/notifications').set(auth(clientToken));
    expect(after.body.data.unread).toBe(1);
  });

  it('will not let a client mark somebody else’s as read', async () => {
    const list = await request(app).get('/api/notifications').set(auth(clientToken));
    const target = list.body.data.notifications[0].id;

    // Reads as absent rather than forbidden: another client has no
    // business learning that this notification exists.
    const res = await request(app).post(`/api/notifications/${target}/read`).set(auth(otherToken));
    expect(res.status).toBe(404);
  });

  it('marks everything as read at once', async () => {
    const res = await request(app).post('/api/notifications/read-all').set(auth(clientToken));
    expect(res.status).toBe(200);

    const after = await request(app).get('/api/notifications').set(auth(clientToken));
    expect(after.body.data.unread).toBe(0);
  });

  it('does not break the booking when writing a notification fails', async () => {
    // A booking that succeeded and then failed to notify is still a
    // booking that succeeded, so notify() swallows its own errors.
    const original = Notification.create;
    Notification.create = () => Promise.reject(new Error('database is on fire'));

    try {
      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/on-the-way`)
        .set(auth(staffToken));
      expect(res.status).toBe(200);
      expect(res.body.data.booking.status).toBe('ON_THE_WAY');
    } finally {
      Notification.create = original;
    }
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
