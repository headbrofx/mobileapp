'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0761${suffix}`;
const otherClientPhone = `0762${suffix}`;

let clientToken;
let otherClientToken;
let familyMemberId;
let otherFamilyMemberId;

const todayIso = new Date().toISOString().slice(0, 10);

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Nutrition Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Nutrition Other Client',
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

const auth = (token = clientToken) => ({ Authorization: `Bearer ${token}` });

describe('Phase 10 — Food catalogue', () => {
  it('serves the seeded Tanzanian foods and searches in both languages', async () => {
    const all = await request(app).get('/api/foods').set(auth());
    expect(all.status).toBe(200);
    expect(all.body.data.foods.length).toBeGreaterThanOrEqual(40);
    expect(all.body.data.foods.some((food) => food.nameSw === 'Ugali wa mahindi')).toBe(true);

    const sw = await request(app).get('/api/foods?q=wali').set(auth());
    expect(sw.body.data.foods.some((food) => food.nameSw === 'Wali')).toBe(true);

    const en = await request(app).get('/api/foods?q=beans').set(auth());
    expect(en.body.data.foods.some((food) => food.nameSw === 'Maharage')).toBe(true);
  });

  it('never claims the calorie figures are precise', async () => {
    const res = await request(app).get('/api/foods?q=ugali').set(auth());
    expect(res.body.data.caloriesAreApproximate).toBe(true);
    expect(res.body.data.disclaimer).toMatch(/makadirio/);
    // Nothing has been signed off by a nutritionist yet, and the
    // catalogue does not pretend otherwise.
    expect(res.body.data.foods.every((food) => food.verifiedByProfessional === false)).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/foods');
    expect(res.status).toBe(401);
  });
});

describe('Phase 10 — Logging meals', () => {
  it('fills in calories from the catalogue', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({
        mealType: 'LUNCH',
        items: [{ name: 'Wali' }, { name: 'Maharage' }, { name: 'Mchicha' }],
      });

    expect(res.status).toBe(201);
    const { meal } = res.body.data;
    expect(meal.items).toHaveLength(3);
    expect(meal.items.every((item) => item.matched)).toBe(true);
    // 200 + 230 + 60
    expect(meal.totalCalories).toBe(490);
    expect(res.body.data.caloriesAreApproximate).toBe(true);
  });

  it('scales by quantity', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'BREAKFAST', items: [{ name: 'Chapati', quantity: 2 }] });

    expect(res.body.data.meal.totalCalories).toBe(500);
    expect(res.body.data.meal.items[0].servingDescription).toMatch(/Chapati 1/);
  });

  it('matches a food by its English name too', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'SNACK', items: [{ name: 'Egg', quantity: 2 }] });

    expect(res.body.data.meal.items[0].name).toBe('Yai');
    expect(res.body.data.meal.totalCalories).toBe(160);
  });

  it('keeps an unknown food without inventing a number for it', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'DINNER', items: [{ name: 'Kitoweo cha bibi yangu' }] });

    const item = res.body.data.meal.items[0];
    expect(item.matched).toBe(false);
    expect(item.calories).toBeNull();
    // No countable items at all, so no total — not a zero, which would
    // read as having eaten nothing.
    expect(res.body.data.meal.totalCalories).toBeNull();
  });

  it('uses a calorie figure the user supplied for an unknown food', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'SNACK', items: [{ name: 'Keki ya harusi', calories: 300 }] });

    expect(res.body.data.meal.items[0].matched).toBe(false);
    expect(res.body.data.meal.totalCalories).toBe(300);
  });

  it('rejects a meal with no items and an unknown meal type', async () => {
    const empty = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'LUNCH', items: [] });
    expect(empty.status).toBe(400);

    const badType = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'BRUNCH', items: [{ name: 'Wali' }] });
    expect(badType.status).toBe(400);
  });

  it('lists and deletes meals', async () => {
    const list = await request(app)
      .get(`/api/family-members/${familyMemberId}/meals?date=${todayIso}`)
      .set(auth());
    expect(list.status).toBe(200);
    const before = list.body.data.meals.length;
    expect(before).toBeGreaterThan(0);

    const target = list.body.data.meals[0].id;
    const del = await request(app)
      .delete(`/api/family-members/${familyMemberId}/meals/${target}`)
      .set(auth());
    expect(del.status).toBe(200);

    const after = await request(app)
      .get(`/api/family-members/${familyMemberId}/meals?date=${todayIso}`)
      .set(auth());
    expect(after.body.data.meals.length).toBe(before - 1);
  });
});

describe('Phase 10 — Water', () => {
  it('logs and totals water for the day', async () => {
    for (const amountMl of [500, 300, 250]) {
      const res = await request(app)
        .post(`/api/family-members/${familyMemberId}/water`)
        .set(auth())
        .send({ amountMl });
      expect(res.status).toBe(201);
    }

    const list = await request(app)
      .get(`/api/family-members/${familyMemberId}/water?date=${todayIso}`)
      .set(auth());
    expect(list.body.data.entries.length).toBe(3);
  });

  it('rejects a nonsense amount', async () => {
    const res = await request(app)
      .post(`/api/family-members/${familyMemberId}/water`)
      .set(auth())
      .send({ amountMl: -200 });
    expect(res.status).toBe(400);
  });
});

describe('Phase 10 — Profile and summary', () => {
  it('creates a profile on first read, with no calorie target invented', async () => {
    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/nutrition`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.profile.goal).toBe('GENERAL_HEALTH');
    // Nothing in this codebase calculates one. It is null until a
    // person or their nurse sets it deliberately.
    expect(res.body.data.profile.dailyCalorieTarget).toBeNull();
    expect(res.body.data.profile.dailyWaterTargetMl).toBe(2000);
  });

  it('stores a target only when it is set on purpose', async () => {
    const res = await request(app)
      .put(`/api/family-members/${familyMemberId}/nutrition`)
      .set(auth())
      .send({ goal: 'MANAGE_CONDITION', dailyCalorieTarget: 2200, restrictions: ['no sugar'] });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.dailyCalorieTarget).toBe(2200);
    expect(res.body.data.profile.goal).toBe('MANAGE_CONDITION');
    expect(res.body.data.profile.restrictions).toEqual(['no sugar']);
  });

  it('reports the day without passing judgement on it', async () => {
    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/nutrition/summary?date=${todayIso}`)
      .set(auth());

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.date).toBe(todayIso);
    expect(data.meals.logged).toBeGreaterThan(0);
    expect(data.water.totalMl).toBe(1050);
    expect(data.water.targetMl).toBe(2000);
    expect(data.calorieTarget).toBe(2200);
    expect(data.caloriesAreApproximate).toBe(true);

    // The target is reported, never compared against. No verdict field
    // exists, and none should: an app that tells people they ate too
    // much harms some of the people using it.
    const asText = JSON.stringify(data).toLowerCase();
    expect(asText).not.toMatch(/exceeded|over budget|too much|well done|remaining/);
    expect(data).not.toHaveProperty('verdict');
  });

  it('says how much of the day its calorie number does not cover', async () => {
    await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth())
      .send({ mealType: 'DINNER', items: [{ name: 'Wali' }, { name: 'Chakula kisichojulikana' }] });

    const res = await request(app)
      .get(`/api/family-members/${familyMemberId}/nutrition/summary?date=${todayIso}`)
      .set(auth());

    expect(res.body.data.meals.itemsWithoutCalories).toBeGreaterThan(0);
  });
});

describe('Phase 10 — Access control', () => {
  it('blocks another client from reading or writing this family member', async () => {
    const read = await request(app)
      .get(`/api/family-members/${familyMemberId}/nutrition/summary`)
      .set(auth(otherClientToken));
    expect(read.status).toBe(403);

    const write = await request(app)
      .post(`/api/family-members/${familyMemberId}/meals`)
      .set(auth(otherClientToken))
      .send({ mealType: 'LUNCH', items: [{ name: 'Wali' }] });
    expect(write.status).toBe(403);
  });

  it('keeps each family member’s log separate', async () => {
    const theirs = await request(app)
      .get(`/api/family-members/${otherFamilyMemberId}/meals`)
      .set(auth(otherClientToken));
    expect(theirs.status).toBe(200);
    expect(theirs.body.data.meals.length).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/family-members/${familyMemberId}/nutrition`);
    expect(res.status).toBe(401);
  });
});
