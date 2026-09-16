'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const { SMALL_COUNT_THRESHOLD } = require('../src/services/analytics.service');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0715${suffix}`;

let clientToken;
let adminToken;

afterAll(async () => {
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Analytics Test Client',
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

describe('Phase 16 — Analytics', () => {
  it('reports bookings, visits, money and health signals in one call', async () => {
    const res = await request(app).get('/api/admin/analytics?days=90').set(auth(adminToken));
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.periodDays).toBe(90);
    expect(typeof data.bookings.total).toBe('number');
    expect(data.bookings.byStatus).toBeDefined();
    expect(Array.isArray(data.bookings.perWeek)).toBe(true);
    expect(Array.isArray(data.bookings.topServices)).toBe(true);

    expect(typeof data.visits.started).toBe('number');
    expect(data.revenue.currency).toBe('TZS');
    expect(Array.isArray(data.revenue.byMethod)).toBe(true);
  });

  it('returns null rather than 0% for a rate with nothing behind it', async () => {
    // A window with no bookings has no completion rate. Reporting 0%
    // would claim everything failed.
    const res = await request(app).get('/api/admin/analytics?days=1').set(auth(adminToken));
    const { bookings } = res.body.data;

    if (bookings.total === 0) {
      expect(bookings.completionRate).toBeNull();
      expect(bookings.cancellationRate).toBeNull();
    } else {
      expect(typeof bookings.completionRate).toBe('number');
    }
  });

  it('withholds health breakdowns small enough to identify one household', async () => {
    const res = await request(app).get('/api/admin/analytics?days=365').set(auth(adminToken));
    const { health } = res.body.data;

    expect(health.withheld.threshold).toBe(SMALL_COUNT_THRESHOLD);
    expect(health.withheld.reason).toMatch(/mtu mmoja/);

    // Afya Nyumbani serves a small number of families in one city, so a
    // count of one is not a statistic — it is a person.
    for (const row of health.topSymptoms) {
      expect(row.count).toBeGreaterThanOrEqual(SMALL_COUNT_THRESHOLD);
    }
  });

  it('names nobody anywhere in the response', async () => {
    const res = await request(app).get('/api/admin/analytics?days=365').set(auth(adminToken));
    const asText = JSON.stringify(res.body.data);

    // Aggregates only: no identifiers to join back to a person.
    expect(asText).not.toMatch(/familyMemberId|clientProfileId|patientId|userId|phone/i);
  });

  it('reports how often Afya AI had no answer, as a content gap', async () => {
    const res = await request(app).get('/api/admin/analytics?days=365').set(auth(adminToken));
    const { afyaAi } = res.body.data.health;

    expect(typeof afyaAi.questions).toBe('number');
    expect(typeof afyaAi.redFlags).toBe('number');
    expect(typeof afyaAi.unanswered).toBe('number');
  });

  it('caps an absurd window rather than scanning everything', async () => {
    const res = await request(app).get('/api/admin/analytics?days=99999').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.periodDays).toBe(365);
  });

  it('is admin-only', async () => {
    const blocked = await request(app).get('/api/admin/analytics').set(auth(clientToken));
    expect(blocked.status).toBe(403);

    const anon = await request(app).get('/api/admin/analytics');
    expect(anon.status).toBe(401);
  });
});
