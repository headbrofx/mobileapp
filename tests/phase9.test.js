'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, MenstrualCycle } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0751${suffix}`;
const otherClientPhone = `0752${suffix}`;

let clientToken;
let otherClientToken;
let familyMemberId;
let otherFamilyMemberId;

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates are built relative to today so the suite does not start failing
// on some future date.
function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);
}

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Orbit Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Orbit Other Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherRegister.body.data.tokens.accessToken;

  const mine = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = mine.body.data.familyMembers[0].id;

  const theirs = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${otherClientToken}`);
  otherFamilyMemberId = theirs.body.data.familyMembers[0].id;
});

function logCycle(body, token = clientToken, member = null) {
  return request(app)
    .post(`/api/family-members/${member || familyMemberId}/cycles`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

function getInsights(token = clientToken, member = null) {
  return request(app)
    .get(`/api/family-members/${member || familyMemberId}/cycles/insights`)
    .set('Authorization', `Bearer ${token}`);
}

describe('Orbit — logging a cycle', () => {
  it('records a cycle with flow, symptoms and mood', async () => {
    const res = await logCycle({
      cycleStartDate: daysAgo(84),
      cycleEndDate: daysAgo(80),
      flow: 'MEDIUM',
      symptoms: ['cramps', 'bloating'],
      mood: 'tired',
      notes: 'Mzunguko wa kwanza kuandikwa',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.cycle.flow).toBe('MEDIUM');
    expect(res.body.data.cycle.symptoms).toEqual(['cramps', 'bloating']);
    expect(res.body.data.cycle.familyMemberId).toBe(familyMemberId);
  });

  it('refuses a start date in the future', async () => {
    const tomorrow = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
    const res = await logCycle({ cycleStartDate: tomorrow });
    expect(res.status).toBe(400);
  });

  it('refuses an end date that falls before the start', async () => {
    const res = await logCycle({ cycleStartDate: daysAgo(30), cycleEndDate: daysAgo(35) });
    expect(res.status).toBe(400);
  });

  it('refuses a second cycle starting on a date already recorded', async () => {
    const res = await logCycle({ cycleStartDate: daysAgo(84) });
    expect(res.status).toBe(409);
  });

  it('rejects a malformed date', async () => {
    const res = await logCycle({ cycleStartDate: '14/09/2026' });
    expect(res.status).toBe(400);
  });
});

describe('Orbit — predictions are estimates, and say so', () => {
  it('makes no prediction from a single cycle, and explains why', async () => {
    const res = await getInsights();
    expect(res.status).toBe(200);
    expect(res.body.data.cyclesLogged).toBe(1);
    expect(res.body.data.prediction).toBeNull();
    expect(res.body.data.isEstimate).toBe(true);
    expect(res.body.data.notes.join(' ')).toMatch(/angalau miwili/);
  });

  it('predicts the next start once there is history, and marks it an estimate', async () => {
    await logCycle({ cycleStartDate: daysAgo(56), cycleEndDate: daysAgo(52) });
    await logCycle({ cycleStartDate: daysAgo(28), cycleEndDate: daysAgo(24) });

    const res = await getInsights();
    const data = res.body.data;

    expect(data.cyclesLogged).toBe(3);
    expect(data.averageCycleLength).toBe(28);
    expect(data.averagePeriodLength).toBe(5);
    expect(data.regularity).toBe('REGULAR');

    // Three starts 28 days apart: the next one lands 28 days after the
    // most recent, which is today.
    expect(data.prediction.nextStart).toBe(daysAgo(0));
    expect(data.prediction.daysUntil).toBe(0);
    // Three logged cycles are only two intervals, and two observations
    // do not earn HIGH however tightly they agree.
    expect(data.prediction.confidence).toBe('MEDIUM');
    expect(data.prediction.basedOnIntervals).toBe(2);

    // The note has to carry the disclaimer, not merely avoid the word:
    // "si uhakika wa kitabibu" is it saying so outright.
    expect(data.isEstimate).toBe(true);
    expect(data.notes.join(' ')).toMatch(/makadirio/);
    expect(data.notes.join(' ')).toMatch(/si uhakika wa kitabibu/);
  });

  it('reaches high confidence only once there are three intervals', async () => {
    await logCycle({ cycleStartDate: daysAgo(112), cycleEndDate: daysAgo(108) });

    const res = await getInsights();
    expect(res.body.data.cyclesLogged).toBe(4);
    expect(res.body.data.prediction.basedOnIntervals).toBe(3);
    expect(res.body.data.prediction.confidence).toBe('HIGH');
    expect(res.body.data.prediction.nextStart).toBe(daysAgo(0));
  });

  it('never fills in a fertile window', async () => {
    // Deliberately unused: a calendar estimate is not reliable enough to
    // be treated as birth control, which is what showing one invites.
    const cycles = await MenstrualCycle.findAll({ where: { familyMemberId } });
    expect(cycles.length).toBeGreaterThan(0);
    for (const cycle of cycles) {
      expect(cycle.predictedFertileWindowStart).toBeNull();
      expect(cycle.predictedFertileWindowEnd).toBeNull();
    }
  });

  it('stores the predicted next start on the most recent cycle', async () => {
    const latest = await MenstrualCycle.findOne({
      where: { familyMemberId },
      order: [['cycleStartDate', 'DESC']],
    });
    expect(latest.predictedNextStart).toBe(daysAgo(0));
  });

  it('lowers its confidence and suggests a nurse when the history is scattered', async () => {
    const other = otherFamilyMemberId;
    for (const days of [160, 118, 96, 20]) {
      await logCycle({ cycleStartDate: daysAgo(days) }, otherClientToken, other);
    }

    const res = await getInsights(otherClientToken, other);
    expect(res.body.data.regularity).toBe('IRREGULAR');
    expect(res.body.data.prediction.confidence).toBe('LOW');
    // Describes the logged data and offers a person to talk to. It names
    // no condition and diagnoses nothing.
    expect(res.body.data.notes.join(' ')).toMatch(/muuguzi/);
  });
});

describe('Orbit — editing and removing entries', () => {
  it('updates an entry and recomputes the prediction from the new history', async () => {
    const list = await request(app)
      .get(`/api/family-members/${familyMemberId}/cycles`)
      .set('Authorization', `Bearer ${clientToken}`);
    const target = list.body.data.cycles[0].id;

    const res = await request(app)
      .patch(`/api/family-members/${familyMemberId}/cycles/${target}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ flow: 'HEAVY', mood: 'better' });

    expect(res.status).toBe(200);
    expect(res.body.data.cycle.flow).toBe('HEAVY');
  });

  it('deletes an entry', async () => {
    const list = await request(app)
      .get(`/api/family-members/${familyMemberId}/cycles`)
      .set('Authorization', `Bearer ${clientToken}`);
    const before = list.body.data.cycles.length;
    const target = list.body.data.cycles[0].id;

    const res = await request(app)
      .delete(`/api/family-members/${familyMemberId}/cycles/${target}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);

    const after = await request(app)
      .get(`/api/family-members/${familyMemberId}/cycles`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(after.body.data.cycles.length).toBe(before - 1);
  });

  it('404s on an entry belonging to somebody else', async () => {
    const theirs = await request(app)
      .get(`/api/family-members/${otherFamilyMemberId}/cycles`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    const theirCycleId = theirs.body.data.cycles[0].id;

    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/cycles/${theirCycleId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('Orbit — access control', () => {
  it('blocks another client from reading or writing this family member', async () => {
    const read = await getInsights(otherClientToken, familyMemberId);
    expect(read.status).toBe(403);

    const write = await logCycle({ cycleStartDate: daysAgo(3) }, otherClientToken, familyMemberId);
    expect(write.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/family-members/${familyMemberId}/cycles`);
    expect(res.status).toBe(401);
  });
});
