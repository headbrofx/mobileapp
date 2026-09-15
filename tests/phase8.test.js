'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, KnowledgeItem, AiInteraction, AuditLog } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0741${suffix}`;
const otherClientPhone = `0742${suffix}`;

let clientToken;
let otherClientToken;
let adminToken;
let familyMemberId;
let otherFamilyMemberId;
let healthItemId;

afterAll(async () => {
  await KnowledgeItem.destroy({ where: { source: `test-${suffix}` } });
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Afya AI Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Afya AI Other Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherRegister.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  const mine = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = mine.body.data.familyMembers[0].id;

  const theirs = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${otherClientToken}`);
  otherFamilyMemberId = theirs.body.data.familyMembers[0].id;
});

function ask(token, body) {
  return request(app).post('/api/ai/ask').set('Authorization', `Bearer ${token}`).send(body);
}

describe('Phase 8 — Red flags come before everything else', () => {
  it('treats a swallowed-poison report as an emergency and never answers it from the knowledge base', async () => {
    const res = await ask(clientToken, { question: 'mtoto amemeza sumu', familyMemberId });

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('RED_FLAG');
    expect(res.body.data.redFlag).toBe(true);
    expect(res.body.data.redFlagCategories).toContain('SUMU');
    expect(res.body.data.sources).toEqual([]);
    expect(res.body.data.answer).toMatch(/DHARURA|EMERGENCY/);
  });

  it('matches the conjugated Swahili verb, not just the dictionary form', async () => {
    // "kumeza sumu" is how it gets written down; "amemeza sumu" is how a
    // parent actually types it. Both have to fire.
    for (const question of ['kumeza sumu', 'mtoto wangu amemeza sumu', 'nimemeza sumu']) {
      const res = await ask(clientToken, { question });
      expect(res.body.data.redFlag).toBe(true);
      expect(res.body.data.redFlagCategories).toContain('SUMU');
    }
  });

  it('recognises emergencies in English too, and reports every one it finds', async () => {
    const res = await ask(clientToken, { question: 'my father cant breathe and has chest pain' });
    expect(res.body.data.redFlag).toBe(true);
    expect(res.body.data.redFlagCategories).toEqual(expect.arrayContaining(['KUPUMUA', 'KIFUA']));
  });

  it('gives self-harm its own wording rather than a generic hospital instruction', async () => {
    const res = await ask(clientToken, { question: 'nataka kujiua' });
    expect(res.body.data.redFlagCategories).toContain('KUJIDHURU');
    expect(res.body.data.answer).toMatch(/Pole sana/);
    expect(res.body.data.answer).not.toMatch(/HII NI DHARURA/);
  });

  it('writes an audit record for every red flag', async () => {
    const res = await ask(clientToken, { question: 'mama ana degedege', familyMemberId });
    const audit = await AuditLog.findOne({
      where: { action: 'AI_RED_FLAG', entityId: res.body.data.id },
    });
    expect(audit).not.toBeNull();
  });

  it('always sends a red flag to the review queue', async () => {
    const res = await ask(clientToken, { question: 'anatokwa damu nyingi' });
    expect(res.body.data.needsReview).toBe(true);
  });
});

describe('Phase 8 — Answers only from verified knowledge', () => {
  it('refuses to guess when nothing in the knowledge base matches', async () => {
    const res = await ask(clientToken, { question: `swali lisilo na jibu ${suffix}` });
    expect(res.body.data.outcome).toBe('NO_ANSWER');
    expect(res.body.data.sources).toEqual([]);
    expect(res.body.data.answer).toMatch(/sitakisia|will not guess/i);
  });

  it('withholds clinical material until a professional has signed it off', async () => {
    const created = await request(app)
      .post('/api/ai/knowledge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Chanjo za mtoto ${suffix}`,
        content: `Mtoto anapaswa kupata chanjo zote kulingana na ratiba ya kliniki. Rejea ${suffix}.`,
        category: 'HEALTH_EDUCATION',
        source: `test-${suffix}`,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.item.verifiedByProfessional).toBe(false);
    healthItemId = created.body.data.item.id;

    const before = await ask(clientToken, { question: `chanjo ${suffix}` });
    expect(before.body.data.outcome).toBe('NO_ANSWER');

    const verified = await request(app)
      .post(`/api/ai/knowledge/${healthItemId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(verified.status).toBe(200);
    expect(verified.body.data.item.verifiedByProfessional).toBe(true);
    expect(verified.body.data.item.verifiedBy).not.toBeNull();

    const after = await ask(clientToken, { question: `chanjo ${suffix}` });
    expect(after.body.data.outcome).toBe('ANSWERED');
    expect(after.body.data.sources).toContain(healthItemId);
    // The answer is the vetted entry word for word, not a rewrite of it.
    expect(after.body.data.answer).toContain(`Rejea ${suffix}`);
  });

  it('answers business questions without requiring a clinical sign-off', async () => {
    const created = await request(app)
      .post('/api/ai/knowledge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Bei za huduma ${suffix}`,
        content: `Huduma ya uuguzi nyumbani inaanzia TZS 50000 kwa ziara. Kumbukumbu ${suffix}.`,
        category: 'COMPANY_INFO',
        source: `test-${suffix}`,
      });
    expect(created.body.data.item.verifiedByProfessional).toBe(false);

    const res = await ask(clientToken, { question: `bei za huduma ${suffix}` });
    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.answer).toContain('TZS 50000');
  });

  it('lets only an admin add to or sign off the knowledge base', async () => {
    const create = await request(app)
      .post('/api/ai/knowledge')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Haramu', content: 'Hii haipaswi kuingia', category: 'COMPANY_INFO' });
    expect(create.status).toBe(403);

    const verify = await request(app)
      .post(`/api/ai/knowledge/${healthItemId}/verify`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(verify.status).toBe(403);
  });

  it('hides unverified clinical entries from clients but shows them to an admin', async () => {
    const unverified = await request(app)
      .post('/api/ai/knowledge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Bado haijathibitishwa ${suffix}`,
        content: `Maandishi ya kliniki yanayosubiri usaini ${suffix}.`,
        category: 'HEALTH_EDUCATION',
        source: `test-${suffix}`,
      });
    const pendingId = unverified.body.data.item.id;

    const asClient = await request(app)
      .get('/api/ai/knowledge')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.body.data.items.some((item) => item.id === pendingId)).toBe(false);

    const asAdmin = await request(app)
      .get('/api/ai/knowledge')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.body.data.items.some((item) => item.id === pendingId)).toBe(true);
  });
});

describe('Phase 8 — Access control', () => {
  it('refuses a question asked about another client family member', async () => {
    const res = await ask(clientToken, {
      question: 'ana homa kidogo',
      familyMemberId: otherFamilyMemberId,
    });
    expect(res.status).toBe(403);
  });

  it('scopes history to the person who asked', async () => {
    const mine = await request(app)
      .get('/api/ai/history')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.interactions.length).toBeGreaterThan(0);

    const theirs = await request(app)
      .get('/api/ai/history')
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(theirs.body.data.interactions.length).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/ai/ask').send({ question: 'habari' });
    expect(res.status).toBe(401);
  });

  it('validates the question', async () => {
    const res = await ask(clientToken, { question: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 8 — Human review queue', () => {
  it('lists pending items for an admin, red flags first, and blocks everyone else', async () => {
    const asClient = await request(app)
      .get('/api/ai/review')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);

    const queue = await request(app)
      .get('/api/ai/review')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queue.status).toBe(200);
    expect(queue.body.data.interactions.length).toBeGreaterThan(0);
    expect(queue.body.data.interactions[0].redFlag).toBe(true);
  });

  it('records who reviewed an interaction and what they concluded', async () => {
    const queue = await request(app)
      .get('/api/ai/review')
      .set('Authorization', `Bearer ${adminToken}`);
    const target = queue.body.data.interactions[0].id;

    const res = await request(app)
      .post(`/api/ai/review/${target}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REVIEWED_OK', note: 'Muuguzi amempigia mteja' });

    expect(res.status).toBe(200);
    expect(res.body.data.interaction.reviewStatus).toBe('REVIEWED_OK');
    expect(res.body.data.interaction.reviewedBy).not.toBeNull();
    expect(res.body.data.interaction.reviewedAt).not.toBeNull();

    const reviewed = await AiInteraction.findByPk(target);
    expect(reviewed.reviewerNote).toBe('Muuguzi amempigia mteja');
  });
});
