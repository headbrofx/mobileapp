'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { build, collectRoutes } = require('../src/docs/openapi');

afterAll(async () => {
  await sequelize.close();
});

describe('Phase 18 — API documentation', () => {
  it('documents every route the app actually serves', async () => {
    const { undocumented } = build(app);

    // The whole point of generating the document from the router: a
    // route added without a description fails here rather than quietly
    // going missing from the reference a mobile developer is reading.
    expect(undocumented).toEqual([]);
  });

  it('describes no route the app does not serve', async () => {
    const descriptions = require('../src/docs/descriptions');
    const live = new Set(collectRoutes(app).map((route) => `${route.method} ${route.path}`));

    const phantom = Object.keys(descriptions).filter((key) => !live.has(key));
    expect(phantom).toEqual([]);
  });

  it('serves the document, and it parses as OpenAPI', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('Afya Nyumbani API');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(80);
  });

  it('is readable without a token, since a developer has none yet', async () => {
    const json = await request(app).get('/api/docs.json');
    expect(json.status).toBe(200);

    const page = await request(app).get('/api/docs');
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/swagger-ui/);
  });

  it('turns Express parameters into OpenAPI ones and declares them', async () => {
    const res = await request(app).get('/api/docs.json');
    const path = res.body.paths['/api/family-members/{familyMemberId}/cycles/{cycleId}'];

    expect(path).toBeDefined();
    const names = path.get.parameters.map((p) => p.name);
    expect(names).toEqual(['familyMemberId', 'cycleId']);
    expect(path.get.parameters.every((p) => p.in === 'path' && p.required)).toBe(true);
  });

  it('marks which endpoints need a token and which need a role', async () => {
    const res = await request(app).get('/api/docs.json');

    // Open: a client with no account has to be able to reach these.
    expect(res.body.paths['/api/auth/login'].post.security).toEqual([]);
    expect(res.body.paths['/api/health'].get.security).toEqual([]);

    // Guarded, and the document says by what.
    const roleGuarded = res.body.paths['/api/admin/users/{id}/role'].patch;
    expect(roleGuarded.security).toEqual([{ bearerAuth: [] }]);
    expect(roleGuarded.responses['403'].description).toMatch(/ADMIN/);
  });

  it('documents the response envelope both ways round', async () => {
    const res = await request(app).get('/api/docs.json');
    const schemas = res.body.components.schemas;

    expect(schemas.SuccessEnvelope.properties.success.enum).toEqual([true]);
    expect(schemas.ErrorEnvelope.properties.code).toBeDefined();
  });
});
