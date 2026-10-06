'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

// The owner's rule: consultation and advice cost the client nothing.
// Checked against what a client actually sees, not against the table,
// so a price that leaks through any other path still fails here.

const phone = `0761${Date.now().toString().slice(-6)}`;
let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Free Advice Client', phone, password: 'TestPass123' });
  token = res.body.data.tokens.accessToken;
});

afterAll(async () => {
  await User.destroy({ where: { phone } });
  await sequelize.close();
});

describe('Advice is free', () => {
  it('offers a health consultation, at no charge', async () => {
    const res = await request(app).get('/api/services').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const consultation = res.body.data.services.find((s) => s.name === 'Health Consultation');
    expect(consultation).toBeDefined();
    expect(Number(consultation.basePriceTzs)).toBe(0);
  });

  it('charges nothing for any consultation or education service', async () => {
    const res = await request(app).get('/api/services').set('Authorization', `Bearer ${token}`);
    const advisory = res.body.data.services.filter((s) => ['Consultation', 'Education'].includes(s.category));
    expect(advisory.length).toBeGreaterThanOrEqual(2);
    advisory.forEach((s) => expect(Number(s.basePriceTzs)).toBe(0));
  });
});
