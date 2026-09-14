'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

afterAll(async () => {
  await sequelize.close();
});

describe('Health', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/health/db confirms database connectivity', async () => {
    const res = await request(app).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/unknown-route returns 404 in the standard envelope', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
