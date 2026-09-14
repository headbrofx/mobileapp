'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

const testPhone = '0798765432';

afterAll(async () => {
  await User.destroy({ where: { phone: testPhone } });
  await sequelize.close();
});

describe('Auth', () => {
  it('registers a new client', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jest Test User',
      phone: testPhone,
      password: 'TestPass123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CLIENT');
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('rejects a weak/invalid registration payload', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'X',
      phone: 'not-a-phone',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: testPhone,
      password: 'TestPass123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: testPhone,
      password: 'WrongPassword',
    });
    expect(res.status).toBe(401);
  });

  it('blocks /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('allows /me with a valid token', async () => {
    const login = await request(app).post('/api/auth/login').send({
      identifier: testPhone,
      password: 'TestPass123',
    });
    const token = login.body.data.tokens.accessToken;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe(testPhone);
  });
});
