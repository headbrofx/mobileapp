'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0771${suffix}`;
const otherClientPhone = `0772${suffix}`;

let clientToken;
let otherClientToken;
let familyMemberId;

const DAY_MS = 24 * 60 * 60 * 1000;
const todayIso = new Date().toISOString().slice(0, 10);
const yesterdayIso = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Fitness Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Fitness Other Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherRegister.body.data.tokens.accessToken;

  const mine = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${clientToken}`);
  familyMemberId = mine.body.data.familyMembers[0].id;
});

const auth = (token = clientToken) => ({ Authorization: `Bearer ${token}` });
const base = () => `/api/family-members/${familyMemberId}`;

describe('Phase 11 — Workouts', () => {
  it('logs a workout', async () => {
    const res = await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Kutembea', durationMinutes: 30, intensity: 'MODERATE' });

    expect(res.status).toBe(201);
    expect(res.body.data.workout.exerciseType).toBe('Kutembea');
    expect(res.body.data.workout.durationMinutes).toBe(30);
  });

  it('never works out calories burned on the user’s behalf', async () => {
    const res = await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Kukimbia', durationMinutes: 20, intensity: 'HIGH' });

    // The formula needs body weight and a MET value, and produces a wide
    // guess dressed as a number. Left null unless the user supplies it.
    expect(res.body.data.workout.caloriesBurned).toBeNull();
  });

  it('keeps a calorie figure the user supplied', async () => {
    const res = await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Baiskeli', durationMinutes: 45, caloriesBurned: 300 });

    expect(res.body.data.workout.caloriesBurned).toBe(300);
  });

  it('rejects a workout with no duration or an absurd one', async () => {
    const none = await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Kutembea' });
    expect(none.status).toBe(400);

    const absurd = await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Kutembea', durationMinutes: 5000 });
    expect(absurd.status).toBe(400);
  });

  it('lists and deletes workouts', async () => {
    const list = await request(app).get(`${base()}/workouts`).set(auth());
    expect(list.status).toBe(200);
    const before = list.body.data.workouts.length;
    expect(before).toBe(3);

    const del = await request(app)
      .delete(`${base()}/workouts/${list.body.data.workouts[0].id}`)
      .set(auth());
    expect(del.status).toBe(200);

    const after = await request(app).get(`${base()}/workouts`).set(auth());
    expect(after.body.data.workouts.length).toBe(before - 1);
  });
});

describe('Phase 11 — Daily activity', () => {
  it('records a day of steps', async () => {
    const res = await request(app)
      .put(`${base()}/activity`)
      .set(auth())
      .send({ date: todayIso, steps: 6000, distanceKm: 4.2, activeMinutes: 55 });

    expect(res.status).toBe(200);
    expect(res.body.data.activity.steps).toBe(6000);
  });

  it('corrects the same day rather than adding to it', async () => {
    // A pedometer reports a running total, so the second reading for a
    // day replaces the first. Adding them would double-count.
    const res = await request(app)
      .put(`${base()}/activity`)
      .set(auth())
      .send({ date: todayIso, steps: 9000, distanceKm: 6.1, activeMinutes: 70 });

    expect(res.body.data.activity.steps).toBe(9000);

    const list = await request(app).get(`${base()}/activity`).set(auth());
    expect(list.body.data.activity.filter((a) => a.date === todayIso).length).toBe(1);
  });

  it('refuses a future date and an entry with nothing in it', async () => {
    const tomorrow = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
    const future = await request(app)
      .put(`${base()}/activity`)
      .set(auth())
      .send({ date: tomorrow, steps: 100 });
    expect(future.status).toBe(400);

    const empty = await request(app).put(`${base()}/activity`).set(auth()).send({ date: todayIso });
    expect(empty.status).toBe(400);
  });
});

describe('Phase 11 — Summary', () => {
  it('totals the week without setting a target to fall short of', async () => {
    await request(app)
      .put(`${base()}/activity`)
      .set(auth())
      .send({ date: yesterdayIso, steps: 3000, distanceKm: 2.0 });

    const res = await request(app).get(`${base()}/fitness/summary?days=7`).set(auth());
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.workouts.count).toBe(2);
    expect(data.workouts.totalMinutes).toBeGreaterThan(0);
    expect(data.activity.daysLogged).toBe(2);
    expect(data.activity.totalSteps).toBe(12000);
    expect(data.activity.averageStepsPerDay).toBe(6000);

    // Public activity guidelines are written for healthy adults, and
    // many people this app serves are not. No target is returned, so
    // nobody is told they fell short of one meant for somebody else.
    const asText = JSON.stringify(data).toLowerCase();
    expect(asText).not.toMatch(/target|goal of|recommended|should aim|150 min/);
    expect(data).not.toHaveProperty('weeklyTarget');
  });

  it('reports only calories the user logged by hand, and null when there are none', async () => {
    // The workout carrying a figure was the one deleted earlier, so
    // nothing countable is left: null rather than 0, since 0 would read
    // as having burned nothing.
    const empty = await request(app).get(`${base()}/fitness/summary?days=7`).set(auth());
    expect(empty.body.data.workouts.caloriesBurnedLogged).toBeNull();

    await request(app)
      .post(`${base()}/workouts`)
      .set(auth())
      .send({ exerciseType: 'Kuogelea', durationMinutes: 40, caloriesBurned: 250 });

    const res = await request(app).get(`${base()}/fitness/summary?days=7`).set(auth());
    expect(res.body.data.workouts.caloriesBurnedLogged).toBe(250);
  });

  it('tells a rehab patient the plan belongs to their nurse', async () => {
    const set = await request(app).put(`${base()}/fitness`).set(auth()).send({ goal: 'REHAB' });
    expect(set.status).toBe(200);

    const res = await request(app).get(`${base()}/fitness/summary`).set(auth());
    expect(res.body.data.goal).toBe('REHAB');
    expect(res.body.data.notes.join(' ')).toMatch(/muuguzi/);
  });

  it('creates a profile on first read with sane defaults', async () => {
    const other = await request(app)
      .get('/api/family-members')
      .set(auth(otherClientToken));
    const theirMember = other.body.data.familyMembers[0].id;

    const res = await request(app)
      .get(`/api/family-members/${theirMember}/fitness`)
      .set(auth(otherClientToken));

    expect(res.status).toBe(200);
    expect(res.body.data.profile.goal).toBe('GENERAL_FITNESS');
    expect(res.body.data.profile.activityLevel).toBe('SEDENTARY');
  });
});

describe('Phase 11 — Access control', () => {
  it('blocks another client', async () => {
    const read = await request(app).get(`${base()}/fitness/summary`).set(auth(otherClientToken));
    expect(read.status).toBe(403);

    const write = await request(app)
      .post(`${base()}/workouts`)
      .set(auth(otherClientToken))
      .send({ exerciseType: 'Kutembea', durationMinutes: 10 });
    expect(write.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`${base()}/workouts`);
    expect(res.status).toBe(401);
  });
});
