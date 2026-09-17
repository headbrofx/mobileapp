'use strict';

// The seeded knowledge base, tested by asking Afya AI the questions a
// real client would ask. Seeding content nobody ever retrieves would be
// worse than useless — it would look finished while answering nothing.

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, KnowledgeItem } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0719${suffix}`;

let clientToken;

afterAll(async () => {
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Knowledge Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;
});

const ask = (question) =>
  request(app)
    .post('/api/ai/ask')
    .set({ Authorization: `Bearer ${clientToken}` })
    .send({ question });

describe('Seeded knowledge base', () => {
  it('is present and carries no clinical content', async () => {
    const seeded = await KnowledgeItem.findAll({ where: { source: 'seed:knowledge-base' } });
    expect(seeded.length).toBeGreaterThanOrEqual(7);

    // Clinical material has to be written and signed off by somebody
    // qualified. Seeding it would walk straight around the gate that
    // exists to require exactly that.
    expect(seeded.every((item) => item.category !== 'HEALTH_EDUCATION')).toBe(true);
  });

  it('answers what the services cost, with the real prices', async () => {
    const res = await ask('bei za huduma ni ngapi');

    expect(res.status).toBe(200);
    expect(res.body.data.outcome).toBe('ANSWERED');
    // The figures come from the services table, so they are the prices
    // the business actually charges rather than numbers in a document.
    expect(res.body.data.answer).toMatch(/TZS/);
    expect(res.body.data.sources.length).toBeGreaterThan(0);
  });

  it('answers what services are offered', async () => {
    const res = await ask('mnatoa huduma gani');
    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.answer).toMatch(/Home Nursing|huduma/i);
  });

  it('explains how to request a nurse', async () => {
    const res = await ask('nawezaje kuomba muuguzi aje nyumbani');
    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.answer).toMatch(/Omba muuguzi|chagua/i);
  });

  it('says plainly what Afya AI is not', async () => {
    const res = await ask('afya ai ni nini');
    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.answer).toMatch(/SI daktari/);
  });

  it('points at the privacy policy when asked about data', async () => {
    const res = await ask('taarifa zangu zinahifadhiwaje');
    expect(res.body.data.outcome).toBe('ANSWERED');
    expect(res.body.data.answer).toMatch(/privacy/);
  });

  it('refuses clinical questions rather than reaching for business text', async () => {
    // Nothing clinical is seeded, so these have to come back as
    // refusals. An answer would mean business copy being served as
    // health advice, which is the failure this design exists to prevent.
    //
    // The last two are the ones that caught a real bug: before
    // stopwords were stripped, "shinikizo la damu ni nini" scored as
    // highly as a genuine question because "ni" and "nini" matched a
    // title containing both, and a question about medicine caught a page
    // that merely contained the word.
    const clinical = [
      'nina kisukari, nitumie dawa gani',
      'nitumie dawa gani ya malaria',
      'mtoto wangu ana homa kali sana',
      'naumwa kichwa nifanyeje',
      'shinikizo la damu ni nini',
    ];

    for (const question of clinical) {
      const res = await ask(question);
      expect(res.body.data.outcome).toBe('NO_ANSWER');
      expect(res.body.data.answer).toMatch(/sitakisia|will not guess/i);
    }
  });

  it('still puts an emergency ahead of everything', async () => {
    const res = await ask('bei za huduma, na pia mtoto amemeza sumu');

    // A red flag is checked before retrieval runs at all, so a question
    // that also happens to match the price entry never gets a price.
    expect(res.body.data.outcome).toBe('RED_FLAG');
    expect(res.body.data.sources).toEqual([]);
  });
});
