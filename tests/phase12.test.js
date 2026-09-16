'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, MedicationDose, AuditLog } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0781${suffix}`;
const otherClientPhone = `0782${suffix}`;

let clientToken;
let otherClientToken;
let familyMemberId;
let medicationId;

const DAY_MS = 24 * 60 * 60 * 1000;
const todayIso = new Date().toISOString().slice(0, 10);

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Medication Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Medication Other Client',
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

describe('Phase 12 — Recording a medicine', () => {
  it('stores the prescription exactly as written and schedules its doses', async () => {
    const res = await request(app)
      .post(`${base()}/medications`)
      .set(auth())
      .send({
        name: 'Amoxicillin',
        dosage: '500mg',
        form: 'CAPSULE',
        // Times spread across the clock so at least some fall after now
        // whenever the suite happens to run.
        scheduleTimes: ['00:30', '08:00', '14:00', '20:00', '23:30'],
        startDate: todayIso,
        instructions: 'Kunywa baada ya chakula',
        prescribedBy: 'Dkt. Mwakalinga, Muhimbili',
      });

    expect(res.status).toBe(201);
    medicationId = res.body.data.medication.id;

    // Free text, untouched. Nothing parses or converts a dose.
    expect(res.body.data.medication.dosage).toBe('500mg');
    expect(res.body.data.medication.prescribedBy).toBe('Dkt. Mwakalinga, Muhimbili');
    expect(res.body.data.medication.status).toBe('ACTIVE');

    const doses = await MedicationDose.count({ where: { medicationId } });
    expect(doses).toBeGreaterThan(0);
  });

  it('writes an audit record when a medicine is added', async () => {
    const audit = await AuditLog.findOne({
      where: { action: 'MEDICATION_ADDED', entityId: medicationId },
    });
    expect(audit).not.toBeNull();
  });

  it('never schedules a dose in the past', async () => {
    // A reminder for this morning, created this afternoon, helps nobody
    // and would count against adherence for a dose never announced.
    const doses = await MedicationDose.findAll({ where: { medicationId } });
    expect(doses.length).toBeGreaterThan(0);
    for (const dose of doses) {
      expect(new Date(dose.scheduledFor).getTime()).toBeGreaterThanOrEqual(Date.now() - 60 * 1000);
    }
  });

  it('rejects a malformed time, an empty schedule, and an end before the start', async () => {
    const badTime = await request(app)
      .post(`${base()}/medications`)
      .set(auth())
      .send({ name: 'X', dosage: '1', scheduleTimes: ['8am'], startDate: todayIso });
    expect(badTime.status).toBe(400);

    const noTimes = await request(app)
      .post(`${base()}/medications`)
      .set(auth())
      .send({ name: 'X', dosage: '1', scheduleTimes: [], startDate: todayIso });
    expect(noTimes.status).toBe(400);

    const backwards = await request(app)
      .post(`${base()}/medications`)
      .set(auth())
      .send({
        name: 'X',
        dosage: '1',
        scheduleTimes: ['08:00'],
        startDate: todayIso,
        endDate: new Date(Date.now() - 5 * DAY_MS).toISOString().slice(0, 10),
      });
    expect(backwards.status).toBe(400);
  });

  it('does not duplicate doses when the schedule is regenerated', async () => {
    const before = await MedicationDose.count({ where: { medicationId } });

    // Touching the medicine regenerates its schedule; the unique
    // constraint means existing slots are left exactly as they are.
    await request(app)
      .patch(`${base()}/medications/${medicationId}`)
      .set(auth())
      .send({ instructions: 'Kunywa baada ya chakula, na maji mengi' });

    const after = await MedicationDose.count({ where: { medicationId } });
    expect(after).toBe(before);
  });
});

describe('Phase 12 — Doses and adherence', () => {
  it('lists what is due without claiming to have sent anything', async () => {
    const res = await request(app).get(`${base()}/medications/due?hours=48`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.doses.length).toBeGreaterThan(0);
    expect(res.body.data.doses[0].medication.name).toBe('Amoxicillin');
    // There is no SMS or push gateway, and the API says so rather than
    // letting the app assume a reminder went out.
    expect(res.body.data.deliveredByServer).toBe(false);
  });

  it('records a dose as taken, with the time it was taken', async () => {
    const due = await request(app).get(`${base()}/medications/due?hours=48`).set(auth());
    const doseId = due.body.data.doses[0].id;

    const res = await request(app)
      .post(`${base()}/medications/doses/${doseId}`)
      .set(auth())
      .send({ status: 'TAKEN' });

    expect(res.status).toBe(200);
    expect(res.body.data.dose.status).toBe('TAKEN');
    expect(res.body.data.dose.takenAt).not.toBeNull();
  });

  it('records a skipped dose with the reason given', async () => {
    const due = await request(app).get(`${base()}/medications/due?hours=48`).set(auth());
    const doseId = due.body.data.doses[0].id;

    const res = await request(app)
      .post(`${base()}/medications/doses/${doseId}`)
      .set(auth())
      .send({ status: 'SKIPPED', note: 'Nilikuwa safarini' });

    expect(res.body.data.dose.status).toBe('SKIPPED');
    expect(res.body.data.dose.takenAt).toBeNull();
  });

  it('rejects a status it does not recognise', async () => {
    const due = await request(app).get(`${base()}/medications/due?hours=48`).set(auth());
    const doseId = due.body.data.doses[0].id;

    const res = await request(app)
      .post(`${base()}/medications/doses/${doseId}`)
      .set(auth())
      .send({ status: 'MAYBE' });
    expect(res.status).toBe(400);
  });

  it('counts adherence per medicine, and offers no opinion about it', async () => {
    const res = await request(app).get(`${base()}/medications/adherence?days=7`).set(auth());
    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.taken).toBe(1);
    expect(data.skipped).toBe(1);
    expect(data.takenPercent).toBe(50);
    // Per medicine, because one overall figure hides a single medicine
    // being missed every time while the others are taken.
    expect(data.byMedication.Amoxicillin).toEqual({ taken: 1, missed: 0, skipped: 1 });

    // It records and reports. It does not advise, warn or scold.
    const asText = JSON.stringify(data).toLowerCase();
    expect(asText).not.toMatch(/you should|increase|reduce|stop taking|warning|interaction/);
  });

  it('returns null rather than 0% when nothing has come due yet', async () => {
    const other = await request(app).get('/api/family-members').set(auth(otherClientToken));
    const theirMember = other.body.data.familyMembers[0].id;

    const res = await request(app)
      .get(`/api/family-members/${theirMember}/medications/adherence`)
      .set(auth(otherClientToken));

    // Not the same claim as having missed everything.
    expect(res.body.data.takenPercent).toBeNull();
    expect(res.body.data.dosesAnswered).toBe(0);
  });
});

describe('Phase 12 — Stopping a course', () => {
  it('clears future doses but keeps the ones already answered', async () => {
    const answeredBefore = await MedicationDose.count({
      where: { medicationId, status: ['TAKEN', 'SKIPPED'] },
    });
    expect(answeredBefore).toBe(2);

    const res = await request(app)
      .patch(`${base()}/medications/${medicationId}`)
      .set(auth())
      .send({ status: 'STOPPED' });
    expect(res.status).toBe(200);
    expect(res.body.data.medication.status).toBe('STOPPED');

    const pendingAfter = await MedicationDose.count({ where: { medicationId, status: 'PENDING' } });
    expect(pendingAfter).toBe(0);

    // History is not rewritten when a course ends.
    const answeredAfter = await MedicationDose.count({
      where: { medicationId, status: ['TAKEN', 'SKIPPED'] },
    });
    expect(answeredAfter).toBe(2);
  });

  it('writes an audit record when a course is stopped', async () => {
    const audit = await AuditLog.findOne({
      where: { action: 'MEDICATION_STOPPED', entityId: medicationId },
    });
    expect(audit).not.toBeNull();
  });
});

describe('Phase 12 — Access control', () => {
  it('blocks another client', async () => {
    const read = await request(app).get(`${base()}/medications`).set(auth(otherClientToken));
    expect(read.status).toBe(403);

    const write = await request(app)
      .post(`${base()}/medications`)
      .set(auth(otherClientToken))
      .send({ name: 'X', dosage: '1', scheduleTimes: ['08:00'], startDate: todayIso });
    expect(write.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`${base()}/medications/due`);
    expect(res.status).toBe(401);
  });
});
