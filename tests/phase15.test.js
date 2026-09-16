'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, AuditLog } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0713${suffix}`;
const victimPhone = `0714${suffix}`;

let clientToken;
let adminToken;
let adminUserId;
let victimUserId;

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, victimPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Ops Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const victim = await request(app).post('/api/auth/register').send({
    name: 'Ops Test Subject',
    phone: victimPhone,
    password: 'TestPass123',
  });
  victimUserId = victim.body.data.user.id;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;
  adminUserId = adminLogin.body.data.user.id;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Phase 15 — Operations dashboard', () => {
  it('gives an admin the morning picture in one call', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(typeof data.bookings.today).toBe('number');
    expect(typeof data.bookings.awaitingAssignment).toBe('number');
    expect(typeof data.staff.awaitingApproval).toBe('number');
    expect(typeof data.clients.total).toBe('number');
    expect(data.money.currency).toBe('TZS');

    // Surfaced on the dashboard so a red flag cannot sit unread in a
    // queue nobody thinks to open.
    expect(typeof data.afyaAi.awaitingReview).toBe('number');
    expect(typeof data.afyaAi.redFlagsLast7Days).toBe('number');
  });

  it('is closed to clients', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(clientToken));
    expect(res.status).toBe(403);
  });
});

describe('Phase 15 — User management', () => {
  it('lists users and never returns a password hash', async () => {
    const res = await request(app).get(`/api/admin/users?q=${suffix}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThan(0);

    for (const user of res.body.data.users) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    }
  });

  it('filters by role and status', async () => {
    const res = await request(app).get('/api/admin/users?role=CLIENT').set(auth(adminToken));
    expect(res.body.data.users.every((u) => u.role === 'CLIENT')).toBe(true);
  });

  it('suspends an account rather than deleting it, and writes it down', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${victimUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'SUSPENDED' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('SUSPENDED');

    // The account still exists — its bookings, visits and invoices are
    // records a health business has to keep.
    const stillThere = await User.findByPk(victimUserId);
    expect(stillThere).not.toBeNull();

    const audit = await AuditLog.findOne({
      where: { action: 'USER_STATUS_CHANGED', entityId: victimUserId },
    });
    expect(audit).not.toBeNull();
  });

  it('stops a suspended user from logging in, and lets them back after', async () => {
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ identifier: victimPhone, password: 'TestPass123' });
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    await request(app)
      .patch(`/api/admin/users/${victimUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'ACTIVE' });

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ identifier: victimPhone, password: 'TestPass123' });
    expect(ok.status).toBe(200);
  });

  it('will not let an admin suspend or demote themselves', async () => {
    // Either one locks everyone out of the controls that would undo it.
    const status = await request(app)
      .patch(`/api/admin/users/${adminUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'SUSPENDED' });
    expect(status.status).toBe(400);

    const role = await request(app)
      .patch(`/api/admin/users/${adminUserId}/role`)
      .set(auth(adminToken))
      .send({ role: 'CLIENT' });
    expect(role.status).toBe(400);
  });

  it('records a role change, which is the most sensitive thing here', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${victimUserId}/role`)
      .set(auth(adminToken))
      .send({ role: 'STAFF' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('STAFF');

    const audit = await AuditLog.findOne({
      where: { action: 'USER_ROLE_CHANGED', entityId: victimUserId },
    });
    expect(audit).not.toBeNull();
    expect(audit.metadata.from).toBe('CLIENT');
    expect(audit.metadata.to).toBe('STAFF');
  });

  it('rejects a role or status it does not recognise', async () => {
    const badRole = await request(app)
      .patch(`/api/admin/users/${victimUserId}/role`)
      .set(auth(adminToken))
      .send({ role: 'SUPERUSER' });
    expect(badRole.status).toBe(400);

    const badStatus = await request(app)
      .patch(`/api/admin/users/${victimUserId}/status`)
      .set(auth(adminToken))
      .send({ status: 'DELETED' });
    expect(badStatus.status).toBe(400);
  });

  it('keeps user management away from clients', async () => {
    const list = await request(app).get('/api/admin/users').set(auth(clientToken));
    expect(list.status).toBe(403);

    const escalate = await request(app)
      .patch(`/api/admin/users/${victimUserId}/role`)
      .set(auth(clientToken))
      .send({ role: 'ADMIN' });
    expect(escalate.status).toBe(403);
  });
});

describe('Phase 15 — Rosters', () => {
  it('lists staff with their approval state', async () => {
    const res = await request(app).get('/api/admin/staff').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.staff)).toBe(true);
  });

  it('lists bookings and filters them by status', async () => {
    const res = await request(app).get('/api/admin/bookings?status=REQUESTED').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.bookings.every((b) => b.status === 'REQUESTED')).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
