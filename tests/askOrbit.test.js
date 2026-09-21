'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, KnowledgeItem, AiInteraction } = require('../src/models');
const knowledge = require('../src/services/knowledge.service');

// Ask Orbit's structured answers, and the gate in front of them.
//
// The thing worth proving here is not that a structured answer renders.
// It is that an unreviewed one never leaves the database, that a weak
// match is labelled weak and pulled into review, and that an emergency
// gets none of this furniture — no sections, no sources, no confidence,
// because those belong to an explanation and an emergency is not one.

const suffix = Date.now().toString().slice(-6);
const phone = `0792${suffix}`;
const title = `Orbit test entry ${suffix}`;

let token;
let itemId;

const auth = () => ({ Authorization: `Bearer ${token}` });

const SECTIONS = {
  whatMayBeHappening: 'Maelezo ya kwanza ya majaribio.',
  whatToMonitor: 'Cha kufuatilia kwa majaribio.',
  selfCare: 'Unachoweza kufanya kwa majaribio.',
  whenToSeekAdvice: 'Lini kuona mtaalamu kwa majaribio.',
  whenUrgent: 'Lini ni dharura kwa majaribio.',
};

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Ask Orbit Test Client',
    phone,
    password: 'TestPass123',
  });
  token = register.body.data.tokens.accessToken;

  const item = await KnowledgeItem.create({
    title,
    // A distinctive word so retrieval finds this entry and not another.
    content: `Zunguzungu ya majaribio kwa neno ${suffix}. Maelezo ya jumla ya majaribio.`,
    category: 'HEALTH_EDUCATION',
    language: 'SW',
    source: 'Test source — NHS',
    sourceUrl: 'https://example.org/test',
    sections: SECTIONS,
  });
  itemId = item.id;
});

afterAll(async () => {
  await AiInteraction.destroy({ where: { question: `zunguzungu ${suffix}` } });
  await KnowledgeItem.destroy({ where: { id: itemId } });
  await User.destroy({ where: { phone } });
  await sequelize.close();
});

describe('Ask Orbit — the review gate', () => {
  it('will not serve a clinical entry that nobody has signed off', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth())
      .send({ question: `zunguzungu ${suffix}` });

    expect(res.status).toBe(200);
    // The entry exists and matches on a unique word. It is still not used.
    expect(res.body.data.outcome).toBe('NO_ANSWER');
    expect(res.body.data.sections ?? null).toBeNull();
    expect(res.body.data.references ?? []).toHaveLength(0);
  });

  it('serves it, with its sections and sources, once it is signed off', async () => {
    await knowledge.verify(itemId, null);

    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth())
      .send({ question: `zunguzungu ${suffix}` });

    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.sections).toMatchObject(SECTIONS);

    const [ref] = res.body.data.references;
    expect(ref.title).toBe(title);
    expect(ref.source).toBe('Test source — NHS');
    expect(ref.sourceUrl).toBe('https://example.org/test');
    expect(ref.reviewed).toBe(true);
    expect(ref.contentVersion).toBe(1);
  });

  it('never returns who wrote or reviewed an entry to the client', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth())
      .send({ question: `zunguzungu ${suffix}` });

    const [ref] = res.body.data.references;
    // A reference is a whitelist, not the row.
    expect(ref).not.toHaveProperty('createdBy');
    expect(ref).not.toHaveProperty('verifiedBy');
    expect(ref).not.toHaveProperty('reviewNote');
    expect(ref).not.toHaveProperty('content');
  });
});

describe('Ask Orbit — an emergency gets none of the furniture', () => {
  it('answers a red flag with guidance alone', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth())
      .send({ question: 'nina maumivu ya kifua na nashindwa kupumua' });

    expect(res.body.data.redFlag).toBe(true);
    expect(res.body.data.outcome).toBe('RED_FLAG');
    // No explanation, no citations, no score — this is not an
    // explanation, it is an instruction to leave the app.
    expect(res.body.data.sections ?? null).toBeNull();
    expect(res.body.data.references ?? []).toHaveLength(0);
    expect(res.body.data.confidence).toBe('NONE');
  });
});

describe('Ask Orbit — confidence', () => {
  it('scores nothing when nothing matched', () => {
    expect(knowledge.scoreConfidence([]).confidence).toBe('NONE');
  });

  it('calls a strong, clear winner HIGH', () => {
    const scored = knowledge.scoreConfidence([{ rank: 0.09 }, { rank: 0.02 }]);
    expect(scored.confidence).toBe('HIGH');
  });

  it('will not call a crowded field HIGH, however strong the top match', () => {
    // Three entries almost level is a shelf, not an answer.
    const scored = knowledge.scoreConfidence([{ rank: 0.09 }, { rank: 0.088 }]);
    expect(scored.confidence).toBe('MEDIUM');
  });

  it('calls a weak match LOW', () => {
    expect(knowledge.scoreConfidence([{ rank: 0.03 }]).confidence).toBe('LOW');
  });

  it('records the confidence on the interaction so it can be audited', async () => {
    const res = await request(app)
      .post('/api/ai/ask')
      .set(auth())
      .send({ question: `zunguzungu ${suffix}` });

    const row = await AiInteraction.findByPk(res.body.data.id);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(row.confidence);
    expect(row.matchRank).not.toBeNull();
  });
});
