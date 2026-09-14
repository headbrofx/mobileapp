'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Staff } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0793${suffix}`;
const staffPhone = `0794${suffix}`;

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, staffPhone] } });
  await sequelize.close();
});

async function loginAsSeededAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: '0700000003', password: 'Password123!' });
  return res.body.data.tokens.accessToken;
}

describe('Phase 2 — Logout & session management', () => {
  it('revokes a refresh token on logout so it can no longer be used', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Session Test User',
      phone: clientPhone,
      password: 'TestPass123',
    });
    const { accessToken, refreshToken } = register.body.data.tokens;

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const refreshAttempt = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshAttempt.status).toBe(401);
  });

  it('rotates refresh tokens and rejects re-use of an already-rotated token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'TestPass123' });
    const firstRefresh = login.body.data.tokens.refreshToken;

    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.tokens.refreshToken).not.toBe(firstRefresh);

    // Re-using the now-rotated-away token must fail (reuse detection).
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: firstRefresh });
    expect(reuse.status).toBe(401);

    // And because reuse revokes the whole family, the *new* token from the
    // legitimate rotation is also dead now.
    const newToken = rotated.body.data.tokens.refreshToken;
    const afterReuse = await request(app).post('/api/auth/refresh').send({ refreshToken: newToken });
    expect(afterReuse.status).toBe(401);
  });

  it('lists and revokes individual sessions, and logout-all kills every session', async () => {
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'TestPass123' });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'TestPass123' });
    const accessToken = loginA.body.data.tokens.accessToken;

    const sessions = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${accessToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.sessions.length).toBeGreaterThanOrEqual(2);

    const logoutAll = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutAll.status).toBe(200);

    const refreshAfter = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginB.body.data.tokens.refreshToken });
    expect(refreshAfter.status).toBe(401);
  });
});

describe('Phase 2 — Password reset', () => {
  it('resets the password via a one-time token and invalidates the old password', async () => {
    const forgot = await request(app).post('/api/auth/password/forgot').send({ identifier: clientPhone });
    expect(forgot.status).toBe(200);
    const token = forgot.body.data.devOnlyToken;
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'BrandNewPass123' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'TestPass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'BrandNewPass123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an already-used or invalid reset token', async () => {
    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ token: 'not-a-real-token', newPassword: 'Whatever123' });
    expect(reset.status).toBe(400);
  });
});

describe('Phase 2 — Phone/email verification', () => {
  it('registers a user as PENDING_VERIFICATION and activates them with the correct code', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Verify Test User',
      phone: `0795${suffix}`,
      password: 'TestPass123',
    });
    expect(register.body.data.user.status).toBe('PENDING_VERIFICATION');
    const code = register.body.data.verification.devOnlyCode;
    expect(code).toMatch(/^\d{6}$/);
    const accessToken = register.body.data.tokens.accessToken;

    const wrongCode = await request(app)
      .post('/api/auth/verify/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ channel: 'PHONE', code: '000000' });
    expect(wrongCode.status).toBe(400);

    const confirm = await request(app)
      .post('/api/auth/verify/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ channel: 'PHONE', code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.user.status).toBe('ACTIVE');

    await User.destroy({ where: { phone: `0795${suffix}` } });
  });
});

describe('Phase 2 — Staff approval & RBAC', () => {
  it('creates a PENDING staff profile on registration, blocks non-admins, and lets an admin approve it', async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Nurse Test User',
      phone: staffPhone,
      password: 'TestPass123',
      role: 'STAFF',
      specialty: 'NURSE',
    });
    const staffAccessToken = register.body.data.tokens.accessToken;

    // The staff member themself is not an admin and can't list/approve staff.
    const forbidden = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${staffAccessToken}`);
    expect(forbidden.status).toBe(403);

    const ownProfile = await request(app)
      .get('/api/staff/me')
      .set('Authorization', `Bearer ${staffAccessToken}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.data.staff.approvalStatus).toBe('PENDING');

    const adminToken = await loginAsSeededAdmin();
    const pendingList = await request(app)
      .get('/api/staff?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pendingList.status).toBe(200);
    const created = pendingList.body.data.staff.find((s) => s.user.phone === staffPhone);
    expect(created).toBeDefined();

    const approve = await request(app)
      .patch(`/api/staff/${created.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.staff.approvalStatus).toBe('APPROVED');
  });
});

describe('Phase 2 — Audit logs', () => {
  it('records security events and is only readable by an admin', async () => {
    const adminToken = await loginAsSeededAdmin();

    const forbidden = await request(app).get('/api/admin/audit-logs');
    expect(forbidden.status).toBe(401);

    const logs = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logs.status).toBe(200);
    expect(logs.body.data.logs.length).toBeGreaterThan(0);
    expect(logs.body.meta.total).toBeGreaterThan(0);

    const actions = logs.body.data.logs.map((l) => l.action);
    expect(actions).toContain('LOGIN_SUCCESS');
  });
});
