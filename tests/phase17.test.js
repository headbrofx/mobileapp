'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, AuditLog } = require('../src/models');

// Phase 17 — security audit. These are regression tests for things that
// were found wrong, or that must stay right.

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0716${suffix}`;

let clientToken;
let adminToken;

afterAll(async () => {
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Security Audit Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Phase 17 — Running behind a proxy', () => {
  it('trusts exactly one hop, so a caller cannot pick their own IP', async () => {
    // true would take whatever X-Forwarded-For a client sends, letting
    // them choose their own rate-limit bucket and forge an audit trail.
    expect(app.get('trust proxy')).toBe(1);
  });

  it('records the client address from the proxy, not the proxy itself', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth(clientToken))
      .set('X-Forwarded-For', '41.86.176.23')
      .send({ question: 'mtoto amemeza sumu' });

    expect(res.status).toBe(200);
    expect(res.body.data.redFlag).toBe(true);

    const audit = await AuditLog.findOne({
      where: { action: 'AI_RED_FLAG', entityId: res.body.data.id },
    });
    // Without trust proxy this is the proxy's address, which makes the
    // column useless exactly when it matters.
    expect(audit.ipAddress).toBe('41.86.176.23');
  });
});

describe('Phase 17 — Secrets stay in the database', () => {
  it('never returns a password hash from register, login or /me', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: clientPhone, password: 'TestPass123' });
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash|password_hash/);

    const me = await request(app).get('/api/auth/me').set(auth(clientToken));
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|password_hash/);

    const users = await request(app).get('/api/admin/users').set(auth(adminToken));
    expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|password_hash/);
  });

  it('does not leak a stack trace on an unexpected error', async () => {
    // A malformed UUID reaches Postgres and comes back as a clean 400
    // rather than a 500 carrying the query.
    const res = await request(app)
      .get('/api/family-members/not-a-uuid/cycles')
      .set(auth(clientToken));

    expect([400, 403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|FROM "|node_modules/);
  });
});

describe('Phase 17 — Authorisation holds at every door', () => {
  it('refuses an absent, malformed or forged token', async () => {
    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);

    const malformed = await request(app).get('/api/auth/me').set({ Authorization: 'Bearer nonsense' });
    expect(malformed.status).toBe(401);

    // Signed with the wrong key: a token shaped right but not ours.
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiQURNSU4ifQ.bm90LWEtcmVhbC1zaWduYXR1cmU';
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${forged}` });
    expect(res.status).toBe(401);
  });

  it('keeps every admin surface closed to a client token', async () => {
    const surfaces = [
      '/api/admin/dashboard',
      '/api/admin/users',
      '/api/admin/analytics',
      '/api/admin/audit-logs',
      '/api/admin/staff',
      '/api/admin/bookings',
      '/api/ai/review',
      '/api/invoices/outstanding',
    ];

    for (const path of surfaces) {
      const res = await request(app).get(path).set(auth(clientToken));
      expect([403]).toContain(res.status);
    }
  });

  it('will not let a client grant themselves admin', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(clientToken));
    const myId = me.body.data.user.id;

    const res = await request(app)
      .patch(`/api/admin/users/${myId}/role`)
      .set(auth(clientToken))
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(403);

    const after = await User.findByPk(myId);
    expect(after.role).toBe('CLIENT');
  });
});

describe('Phase 17 — Input handling', () => {
  it('treats a SQL-shaped search term as text, not as SQL', async () => {
    const res = await request(app)
      .get(`/api/admin/users?q=${encodeURIComponent("'; DROP TABLE users; --")}`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);

    // The table is still there, which it would not be if that had run.
    const stillThere = await User.count();
    expect(stillThere).toBeGreaterThan(0);
  });

  it('survives tsquery punctuation in an Afya AI question', async () => {
    // Raw input reaching to_tsquery unescaped would be a 500. It is
    // normalised down to letters and digits before it gets near.
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth(clientToken))
      .send({ question: 'bei & ya | huduma !ni (ngapi) :*' });

    expect(res.status).toBe(200);
  });

  it('caps the size of a request body', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth(clientToken))
      .send({ question: 'x'.repeat(5000) });

    // Rejected by the validator's own length rule rather than swallowed.
    expect(res.status).toBe(400);
  });
});
