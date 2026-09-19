'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const patterns = require('../src/services/orbitPatterns.service');

// Orbit's pattern engine, tested on what it refuses to say.
//
// The happy path matters less here than the refusals. Anything can
// average five numbers; the thing worth proving is that four days of
// check-ins do not become "your energy is declining", because that
// sentence in a health app is read as a finding about a body.

const suffix = Date.now().toString().slice(-6);
const phone = `0794${suffix}`;

let token;
let memberId;

const day = 24 * 60 * 60 * 1000;
const ago = (n) => new Date(Date.now() - n * day).toISOString().slice(0, 10);

const auth = () => ({ Authorization: `Bearer ${token}` });

async function checkin(date, body) {
  return request(app)
    .post(`/api/family-members/${memberId}/orbit/checkins`)
    .set(auth())
    .send({ checkinDate: date, ...body });
}

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Orbit Test Client',
    phone,
    password: 'TestPass123',
  });
  token = register.body.data.tokens.accessToken;

  const list = await request(app).get('/api/family-members').set(auth());
  memberId = list.body.data.familyMembers[0].id;
});

afterAll(async () => {
  await User.destroy({ where: { phone } });
  await sequelize.close();
});

describe('Orbit — check-ins', () => {
  it('saves a partial check-in, because most people will not fill in eleven fields', async () => {
    const res = await checkin(ago(1), { energy: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.checkin.energy).toBe(2);
    expect(res.body.data.checkin.mood).toBeNull();
  });

  it('merges a second save into the same day instead of creating another', async () => {
    await checkin(ago(1), { mood: 4, symptoms: ['cramps'] });

    const res = await request(app)
      .get(`/api/family-members/${memberId}/orbit/checkins`)
      .set(auth());

    const forThatDay = res.body.data.checkins.filter((c) => c.checkinDate === ago(1));
    expect(forThatDay).toHaveLength(1);
    // The energy from the first save survived a request that never
    // mentioned it.
    expect(forThatDay[0].energy).toBe(2);
    expect(forThatDay[0].mood).toBe(4);
    expect(forThatDay[0].symptoms).toContain('cramps');
  });

  it('accepts a pain of zero as an answer, not as silence', async () => {
    const res = await checkin(ago(2), { pain: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.checkin.pain).toBe(0);
  });

  it('refuses a scale outside its range', async () => {
    const res = await checkin(ago(3), { energy: 9 });
    expect(res.status).toBe(400);
  });

  it('refuses a check-in dated in the future', async () => {
    const tomorrow = new Date(Date.now() + day).toISOString().slice(0, 10);
    const res = await checkin(tomorrow, { energy: 3 });
    expect(res.status).toBe(400);
  });
});

describe('Orbit — what it will not claim', () => {
  it('says NO_DATA rather than inventing an insight for a new account', async () => {
    const fresh = await request(app).post('/api/auth/register').send({
      name: 'Orbit Empty Client',
      phone: `0795${suffix}`,
      password: 'TestPass123',
    });
    const freshToken = fresh.body.data.tokens.accessToken;
    const members = await request(app)
      .get('/api/family-members')
      .set({ Authorization: `Bearer ${freshToken}` });
    const freshMember = members.body.data.familyMembers[0].id;

    const res = await request(app)
      .get(`/api/family-members/${freshMember}/orbit/insight`)
      .set({ Authorization: `Bearer ${freshToken}` });

    expect(res.status).toBe(200);
    expect(res.body.data.insight.status).toBe('NO_DATA');
    expect(res.body.data.insight.insight).toBeNull();

    await User.destroy({ where: { phone: `0795${suffix}` } });
  });

  it('says INSUFFICIENT_DATA while there are fewer days than the threshold', async () => {
    const res = await request(app)
      .get(`/api/family-members/${memberId}/orbit/insight`)
      .set(auth());

    expect(res.body.data.insight.status).toBe('INSUFFICIENT_DATA');
    expect(res.body.data.insight.insight).toBeNull();
    expect(res.body.data.insight.daysNeeded).toBe(patterns.MIN_CHECKINS_FOR_COMPARISON);
  });

  it('reports every pattern section with a status and the day count behind it', async () => {
    const res = await request(app)
      .get(`/api/family-members/${memberId}/orbit/patterns`)
      .set(auth());

    const body = res.body.data.patterns;
    expect(res.status).toBe(200);
    expect(body.daysRecorded).toBeGreaterThan(0);

    for (const field of ['mood', 'energy', 'sleep', 'appetite', 'pain']) {
      expect(['NO_DATA', 'INSUFFICIENT_DATA', 'OBSERVED']).toContain(body.trends[field].status);
    }
    // Nothing about a cycle phase, because no cycle has been recorded.
    expect(body.beforePeriod.energy.status).not.toBe('OBSERVED');
  });
});

describe('Orbit — the pattern engine itself', () => {
  const rows = (values, field = 'energy') =>
    values.map((value, i) => ({ checkinDate: ago(values.length - i), [field]: value }));

  it('gives an average from seven days but no direction', () => {
    const trend = patterns.trendFor(rows([3, 3, 4, 3, 2, 3, 3]), 'energy');
    expect(trend.status).toBe('OBSERVED');
    expect(trend.average).not.toBeNull();
    // Seven days split in half is two halves of three. Not a trend.
    expect(trend.direction).toBe('UNKNOWN');
  });

  it('calls a real drop a drop once there are enough days to compare', () => {
    const trend = patterns.trendFor(rows([5, 5, 5, 5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2]), 'energy');
    expect(trend.status).toBe('OBSERVED');
    expect(trend.direction).toBe('DOWN');
    expect(trend.delta).toBeLessThan(0);
  });

  it('calls a wobble steady rather than a change', () => {
    const trend = patterns.trendFor(rows([3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4]), 'energy');
    expect(trend.direction).toBe('STEADY');
  });

  it('does not count a null as a zero', () => {
    const trend = patterns.trendFor(
      [
        { checkinDate: ago(3), energy: 4 },
        { checkinDate: ago(2), energy: null },
        { checkinDate: ago(1), energy: 4 },
      ],
      'energy'
    );
    expect(trend.daysRecorded).toBe(2);
    expect(trend.average).toBe(4);
  });

  it('will not make a before-period claim from a single cycle', () => {
    const cycles = [{ cycleStartDate: ago(10) }];
    const checkins = Array.from({ length: 20 }, (_, i) => ({
      checkinDate: ago(20 - i),
      energy: 3,
    }));
    const observation = patterns.beforePeriodObservation(checkins, cycles, 'energy', true);
    expect(observation.status).not.toBe('OBSERVED');
  });
});
