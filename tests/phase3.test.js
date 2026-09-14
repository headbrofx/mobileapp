'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Symptom } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0796${suffix}`;
const otherClientPhone = `0797${suffix}`;

let accessToken;
let selfFamilyMemberId;

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Health Engine Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  accessToken = register.body.data.tokens.accessToken;

  const list = await request(app)
    .get('/api/family-members')
    .set('Authorization', `Bearer ${accessToken}`);
  selfFamilyMemberId = list.body.data.familyMembers[0].id;
});

describe('Phase 3 — Registration auto-provisions a SELF family member', () => {
  it('gives every new client a SELF family member with no extra step', async () => {
    const res = await request(app)
      .get('/api/family-members')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.familyMembers).toHaveLength(1);
    expect(res.body.data.familyMembers[0].relationship).toBe('SELF');
    expect(res.body.data.familyMembers[0].isPrimaryAccountHolder).toBe(true);
  });
});

describe('Phase 3 — Family member management', () => {
  it('adds a dependent and lists both family members', async () => {
    const add = await request(app)
      .post('/api/family-members')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Baby Juma', relationship: 'CHILD', gender: 'MALE', dateOfBirth: '2024-01-15' });
    expect(add.status).toBe(201);

    const list = await request(app)
      .get('/api/family-members')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.body.data.familyMembers).toHaveLength(2);
  });

  it('blocks one client from reading another client\'s family member', async () => {
    const otherRegister = await request(app).post('/api/auth/register').send({
      name: 'Other Client',
      phone: otherClientPhone,
      password: 'TestPass123',
    });
    const otherToken = otherRegister.body.data.tokens.accessToken;

    const res = await request(app)
      .get(`/api/family-members/${selfFamilyMemberId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Phase 3 — Health profile', () => {
  it('creates a health profile on first read and updates it', async () => {
    const get = await request(app)
      .get(`/api/family-members/${selfFamilyMemberId}/health-profile`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data.healthProfile.conditions).toEqual([]);

    const update = await request(app)
      .put(`/api/family-members/${selfFamilyMemberId}/health-profile`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        conditions: ['Hypertension'],
        allergies: ['Penicillin'],
        medications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'daily' }],
        bloodType: 'O+',
      });
    expect(update.status).toBe(200);
    expect(update.body.data.healthProfile.conditions).toContain('Hypertension');
    expect(update.body.data.healthProfile.bloodType).toBe('O+');
  });
});

describe('Phase 3 — Vitals CRUD', () => {
  let vitalId;

  it('records a blood pressure reading', async () => {
    const res = await request(app)
      .post(`/api/family-members/${selfFamilyMemberId}/vitals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'BLOOD_PRESSURE', systolic: 150, diastolic: 95, unit: 'mmHg' });
    expect(res.status).toBe(201);
    vitalId = res.body.data.measurement.id;
  });

  it('rejects a blood pressure reading missing systolic/diastolic', async () => {
    const res = await request(app)
      .post(`/api/family-members/${selfFamilyMemberId}/vitals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'BLOOD_PRESSURE', unit: 'mmHg' });
    expect(res.status).toBe(400);
  });

  it('lists, updates and deletes a vital', async () => {
    const list = await request(app)
      .get(`/api/family-members/${selfFamilyMemberId}/vitals`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.body.data.measurements.length).toBeGreaterThanOrEqual(1);

    const update = await request(app)
      .patch(`/api/family-members/${selfFamilyMemberId}/vitals/${vitalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'Repeat reading tomorrow' });
    expect(update.status).toBe(200);
    expect(update.body.data.measurement.notes).toBe('Repeat reading tomorrow');

    const del = await request(app)
      .delete(`/api/family-members/${selfFamilyMemberId}/vitals/${vitalId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(200);
  });
});

describe('Phase 3 — Health timeline', () => {
  it('merges vitals and symptoms into one chronological feed', async () => {
    await request(app)
      .post(`/api/family-members/${selfFamilyMemberId}/vitals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'WEIGHT', value: 68, unit: 'kg' });

    await Symptom.create({
      familyMemberId: selfFamilyMemberId,
      name: 'Headache',
      severity: 'MODERATE',
      frequency: 'INTERMITTENT',
    });

    const res = await request(app)
      .get(`/api/family-members/${selfFamilyMemberId}/timeline`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const types = res.body.data.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['MEASUREMENT', 'SYMPTOM']));
  });
});

describe('Phase 3 — Health insights engine', () => {
  it('flags an abnormal reading, a recurring symptom, and a missing baseline measurement', async () => {
    // Second BP reading (first was 150/95, already deleted above) so a
    // fresh high reading exists to be flagged as abnormal.
    await request(app)
      .post(`/api/family-members/${selfFamilyMemberId}/vitals`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'BLOOD_PRESSURE', systolic: 148, diastolic: 96, unit: 'mmHg' });

    // A second headache within 30 days makes it "recurring".
    await Symptom.create({
      familyMemberId: selfFamilyMemberId,
      name: 'Headache',
      severity: 'MILD',
      frequency: 'INTERMITTENT',
    });

    const res = await request(app)
      .get(`/api/family-members/${selfFamilyMemberId}/insights`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    expect(res.body.data.abnormalReadings.some((r) => r.type === 'BLOOD_PRESSURE' && r.status === 'HIGH')).toBe(true);
    expect(res.body.data.recurringSymptoms.some((s) => s.name === 'Headache' && s.count >= 2)).toBe(true);
    // BLOOD_GLUCOSE was never recorded for this family member.
    expect(res.body.data.missingMeasurements.some((m) => m.type === 'BLOOD_GLUCOSE')).toBe(true);
    expect(res.body.data.disclaimer).toMatch(/not a medical diagnosis/i);
  });
});
