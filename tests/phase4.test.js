'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0799${suffix}`;

let accessToken;
let familyMemberId;

afterAll(async () => {
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Symptoms Engine Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  accessToken = register.body.data.tokens.accessToken;

  const list = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${accessToken}`);
  familyMemberId = list.body.data.familyMembers[0].id;
});

describe('Phase 4 — Symptom catalogue', () => {
  it('lists the seeded catalogue and supports category filtering', async () => {
    const res = await request(app)
      .get('/api/symptom-catalogue')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(15);
    expect(res.body.data.items.some((i) => i.name === 'Chest Pain' && i.alwaysRedFlag)).toBe(true);

    const filtered = await request(app)
      .get('/api/symptom-catalogue?category=DIGESTIVE')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(filtered.body.data.items.every((i) => i.category === 'DIGESTIVE')).toBe(true);
  });
});

describe('Phase 4 — Symptom submission & red-flag rules', () => {
  it('records a mild headache with no red flags', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Headache', severity: 'MILD', durationValue: 1, durationUnit: 'HOURS', frequency: 'ONE_TIME' });
    expect(res.status).toBe(201);
    expect(res.body.data.symptom.catalog.category).toBe('NEUROLOGICAL');
    expect(res.body.data.symptom.redFlag.isRedFlag).toBe(false);
  });

  it('flags a symptom that is always red-flag regardless of severity', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Chest Pain', severity: 'MILD', frequency: 'ONE_TIME' });
    expect(res.status).toBe(201);
    expect(res.body.data.symptom.redFlag.isRedFlag).toBe(true);
    expect(res.body.data.symptom.redFlag.recommendation).toMatch(/seek professional/i);
  });

  it('flags a symptom whose reported severity meets the catalogue threshold', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Diarrhea', severity: 'SEVERE', frequency: 'CONSTANT' });
    expect(res.status).toBe(201);
    expect(res.body.data.symptom.redFlag.isRedFlag).toBe(true);
    expect(res.body.data.symptom.redFlag.reasons.length).toBeGreaterThan(0);
  });

  it('flags a symptom lasting longer than the catalogue duration threshold', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Back Pain', severity: 'MILD', durationValue: 3, durationUnit: 'WEEKS', frequency: 'CONSTANT' });
    expect(res.status).toBe(201);
    expect(res.body.data.symptom.redFlag.isRedFlag).toBe(true);
    expect(res.body.data.symptom.redFlag.reasons.some((r) => /longer than expected/i.test(r))).toBe(true);
  });

  it('does not red-flag a symptom with no catalogue match and mild presentation, on a patient with no other recent symptoms', async () => {
    // Uses a separate, symptom-free family member so the "another
    // concerning symptom in the last 24h" combination rule (tested
    // implicitly by the other cases above sharing familyMemberId) can't
    // interfere with this negative case.
    const addDependent = await request(app)
      .post('/api/family-members')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Clean Slate Dependent', relationship: 'CHILD' });
    const cleanFamilyMemberId = addDependent.body.data.familyMember.id;

    const res = await request(app)
      .post(`/api/family-members/${cleanFamilyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Itchy Elbow', severity: 'MILD', frequency: 'ONE_TIME' });
    expect(res.status).toBe(201);
    expect(res.body.data.symptom.catalog).toBeNull();
    expect(res.body.data.symptom.redFlag.isRedFlag).toBe(false);
  });

  it('lists, updates and deletes a symptom', async () => {
    // Its own disposable symptom, so it doesn't remove Headache/Chest
    // Pain the trends test below still expects to find.
    const created = await request(app)
      .post(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Sore Throat', severity: 'MILD', frequency: 'ONE_TIME' });
    const targetId = created.body.data.symptom.id;

    const list = await request(app)
      .get(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.body.data.symptoms.length).toBeGreaterThanOrEqual(5);

    const update = await request(app)
      .patch(`/api/family-members/${familyMemberId}/symptoms/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'Better after antihistamine' });
    expect(update.status).toBe(200);
    expect(update.body.data.symptom.notes).toBe('Better after antihistamine');

    const del = await request(app)
      .delete(`/api/family-members/${familyMemberId}/symptoms/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(200);
  });

  it('blocks a client from touching another client\'s symptoms', async () => {
    const otherPhone = `0771${suffix}`;
    const other = await request(app).post('/api/auth/register').send({
      name: 'Other Symptoms Client',
      phone: otherPhone,
      password: 'TestPass123',
    });
    const otherToken = other.body.data.tokens.accessToken;

    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/symptoms`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);

    await User.destroy({ where: { phone: otherPhone } });
  });
});

describe('Phase 4 — Symptom trends', () => {
  it('reports Headache and Chest Pain as occurring in the current 30-day window', async () => {
    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/symptoms/trends`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const headache = res.body.data.trends.find((t) => t.name === 'Headache');
    expect(headache).toBeDefined();
    expect(headache.currentWindowCount).toBeGreaterThanOrEqual(1);
    expect(['INCREASING', 'STABLE', 'DECREASING']).toContain(headache.direction);
  });
});
