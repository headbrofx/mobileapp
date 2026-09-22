'use strict';

const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  ClientProfile,
  FamilyMember,
  Service,
  Booking,
  Notification,
} = require('../src/models');

// An order has to reach somebody.
//
// Every other step of a booking notified the client — assigned,
// accepted, on the way, arrived. The one step that notified nobody was
// the first: a client asking for a nurse to come to their house. The
// row was written with status REQUESTED and waited for somebody to
// look, and nothing in the system looks.
//
// This is the test that would have caught that, so it is also the test
// that stops it coming back. It asserts on the admin's side of the
// wire, not on an internal call, because what matters is that a person
// at Afya Nyumbani can see the order — not that a function ran.

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0768${suffix}`;
const adminPhone = `0769${suffix}`;
const inactivePhone = `0767${suffix}`;

let clientToken;
let adminId;
let inactiveId;
let serviceId;
let memberId;
let bookingId;

beforeAll(async () => {
  const register = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Desk Test Client', phone: clientPhone, password: 'TestPass123' });
  clientToken = register.body.data.tokens.accessToken;

  const clientUser = await User.findOne({ where: { phone: clientPhone } });
  const profile = await ClientProfile.findOne({ where: { userId: clientUser.id } });
  const self = await FamilyMember.findOne({ where: { clientProfileId: profile.id } });
  memberId = self.id;

  const service = await Service.findOne({ where: { isActive: true } });
  serviceId = service.id;

  // An admin who should hear about it, and one who is switched off and
  // should not.
  const admin = await User.create({
    name: 'Desk Test Admin',
    phone: adminPhone,
    passwordHash: 'x'.repeat(60),
    role: 'ADMIN',
    status: 'ACTIVE',
  });
  adminId = admin.id;

  const inactive = await User.create({
    name: 'Desk Test Former Admin',
    phone: inactivePhone,
    passwordHash: 'x'.repeat(60),
    role: 'ADMIN',
    status: 'INACTIVE',
  });
  inactiveId = inactive.id;
});

afterAll(async () => {
  if (bookingId) await Booking.destroy({ where: { id: bookingId } });
  await Notification.destroy({ where: { userId: [adminId, inactiveId] } });
  await User.destroy({ where: { phone: [clientPhone, adminPhone, inactivePhone] } });
  await sequelize.close();
});

describe('A new order reaches the desk', () => {
  it('creates the booking', async () => {
    const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set({ Authorization: `Bearer ${clientToken}` })
      .send({
        familyMemberId: memberId,
        serviceId,
        scheduledAt,
        locationAddress: 'Mikocheni B, Dar es Salaam',
        notes: 'Mlango wa pili kushoto',
      });

    expect(res.status).toBe(201);
    bookingId = res.body.data.booking.id;
    expect(res.body.data.booking.status).toBe('REQUESTED');
  });

  it('notifies the active admin, with enough to act on', async () => {
    const rows = await Notification.findAll({ where: { userId: adminId } });
    expect(rows).toHaveLength(1);

    const [row] = rows;
    expect(row.type).toBe('BOOKING');
    expect(row.title).toContain('Ombi jipya');
    // The address is the thing a desk needs first, and the patient's
    // name is how they greet them.
    expect(row.message).toContain('Mikocheni B');
    expect(row.message).toContain('Desk Test Client');
  });

  it('carries the booking id, so whatever reads it can open the order', async () => {
    const [row] = await Notification.findAll({ where: { userId: adminId } });
    expect(row.data.bookingId).toBe(bookingId);
    expect(row.data.status).toBe('REQUESTED');
    expect(row.data.locationAddress).toBe('Mikocheni B, Dar es Salaam');
  });

  it('leaves a deactivated admin out of it', async () => {
    // Somebody who has left the business does not get told about new
    // orders. Their account is off; so is their feed.
    const rows = await Notification.findAll({ where: { userId: inactiveId } });
    expect(rows).toHaveLength(0);
  });
});

describe('Notifying must never cost the booking', () => {
  it('still books when there is no admin to tell', async () => {
    // Production had zero admins on the day this was written. A system
    // that refused orders because nobody was listening would have been
    // worse than one that took them quietly.
    await User.update({ status: 'INACTIVE' }, { where: { id: adminId } });

    const res = await request(app)
      .post('/api/bookings')
      .set({ Authorization: `Bearer ${clientToken}` })
      .send({
        familyMemberId: memberId,
        serviceId,
        scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        locationAddress: 'Sinza, Dar es Salaam',
      });

    expect(res.status).toBe(201);
    await Booking.destroy({ where: { id: res.body.data.booking.id } });
    await User.update({ status: 'ACTIVE' }, { where: { id: adminId } });
  });
});
