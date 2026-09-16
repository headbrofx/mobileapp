'use strict';

// The Vercel entry point is one line, which is exactly why it is worth
// a test: if src/app.js ever stops exporting the app, or starts
// listening on a port of its own, this file is where it would break and
// nothing else would notice until a deploy was already broken.

const request = require('supertest');
const handler = require('../api/index');
const { sequelize } = require('../src/models');

afterAll(async () => {
  await sequelize.close();
});

describe('Vercel serverless entry', () => {
  it('exports something Vercel can call as (req, res)', () => {
    expect(typeof handler).toBe('function');
    // Express apps take (req, res, next); Vercel calls with (req, res).
    expect(handler.length).toBeGreaterThanOrEqual(2);
  });

  it('serves the API through it', async () => {
    const root = await request(handler).get('/');
    expect(root.status).toBe(200);
    expect(root.body.name).toBe('Afya Nyumbani API');

    const health = await request(handler).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.success).toBe(true);
  });

  it('keeps the guards on', async () => {
    const res = await request(handler).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('does not bind a port of its own', () => {
    // src/server.js binds the port. If app.js ever started doing it,
    // every serverless invocation would try to listen and fail.
    const app = require('../src/app');
    expect(handler).toBe(app);
    expect(app.listening).toBeUndefined();
  });
});
