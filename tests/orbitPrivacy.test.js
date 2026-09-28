'use strict';

const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  ClientProfile,
  FamilyMember,
  OrbitCheckin,
  MenstrualCycle,
  AuditLog,
} = require('../src/models');

// The Privacy Centre: what Orbit holds, a copy of it, and forgetting it.
//
// Most of this file is about the third one, because deletion is the
// only operation here that cannot be undone if it is wrong. Two ways it
// could be wrong: erasing somebody else's history, or claiming to erase
// and not doing it. Both are tested, and the first is tested from the
// outside — through the route, with a real second account — because
// ownership is enforced by middleware and a service-level test would
// walk straight past it.
//
// The rest asserts the promise the privacy policy makes: that what is
// held can be seen and counted, that the copy is the rows themselves
// rather than a summary of them, and that nothing the business is
// obliged to keep is quietly swept up with the rest.

const suffix = Date.now().toString().slice(-6);
const herPhone = `0756${suffix}`;
const otherPhone = `0757${suffix}`;

let herToken;
let herMemberId;
let otherToken;
let otherMemberId;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function selfMemberOf(phone) {
  const user = await User.findOne({ where: { phone } });
  const profile = await ClientProfile.findOne({ where: { userId: user.id } });
  const member = await FamilyMember.findOne({ where: { clientProfileId: profile.id } });
  return member.id;
}

// One row per person per day is a unique index, so a second seeding
// inside the same test run has to use different days.
let dayCursor = 1;

async function seedTracking(familyMemberId, { checkins = 3, cycles = 2 } = {}) {
  for (let i = 0; i < checkins; i += 1) {
    await OrbitCheckin.create({
      familyMemberId,
      checkinDate: `2026-08-${String(dayCursor + i).padStart(2, '0')}`,
      mood: 3,
      energy: 4,
      pain: 1,
      symptoms: ['cramps'],
      notes: 'nilijisikia vizuri',
    });
  }
  dayCursor += checkins;

  for (let i = 0; i < cycles; i += 1) {
    await MenstrualCycle.create({
      familyMemberId,
      cycleStartDate: `2026-0${i + 6}-05`,
      flow: 'MEDIUM',
      symptoms: ['bloating'],
    });
  }
}

beforeAll(async () => {
  const her = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Privacy Test Mwanamke', phone: herPhone, password: 'TestPass123' });
  herToken = her.body.data.tokens.accessToken;
  herMemberId = await selfMemberOf(herPhone);

  const other = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Privacy Test Mwingine', phone: otherPhone, password: 'TestPass123' });
  otherToken = other.body.data.tokens.accessToken;
  otherMemberId = await selfMemberOf(otherPhone);

  await seedTracking(herMemberId);
  dayCursor = 1;
  await seedTracking(otherMemberId);
  dayCursor = 20;
});

afterAll(async () => {
  await OrbitCheckin.destroy({ where: { familyMemberId: [herMemberId, otherMemberId] } });
  await MenstrualCycle.destroy({ where: { familyMemberId: [herMemberId, otherMemberId] } });
  await AuditLog.destroy({ where: { entityId: [herMemberId, otherMemberId] } });
  await User.destroy({ where: { phone: [herPhone, otherPhone] } });
  await sequelize.close();
});

describe('What Orbit holds', () => {
  it('counts it, and says when it started', async () => {
    const res = await request(app)
      .get(`/api/family-members/${herMemberId}/orbit/privacy`)
      .set(auth(herToken));

    expect(res.status).toBe(200);
    const { privacy } = res.body.data;

    // A number she can check against her own memory, not a reassurance.
    expect(privacy.dailyCheckins.count).toBe(3);
    expect(privacy.cycleRecords.count).toBe(2);
    expect(privacy.dailyCheckins.firstRecorded).toBe('2026-08-01');
    expect(privacy.dailyCheckins.lastRecorded).toBe('2026-08-03');
  });

  it('names every field it keeps, so there is no fifth thing left unsaid', async () => {
    const res = await request(app)
      .get(`/api/family-members/${herMemberId}/orbit/privacy`)
      .set(auth(herToken));

    const { privacy } = res.body.data;
    expect(privacy.fields.dailyCheckins.length).toBeGreaterThan(3);
    expect(privacy.fields.cycleRecords.length).toBeGreaterThan(3);
    // And says out loud what is not kept, rather than leaving it to be
    // inferred from a policy page nobody opens.
    expect(privacy.notKept.join(' ')).toContain('Mahali ulipo');
  });

  it('shows nothing of somebody else', async () => {
    const res = await request(app)
      .get(`/api/family-members/${otherMemberId}/orbit/privacy`)
      .set(auth(herToken));

    expect([403, 404]).toContain(res.status);
  });
});

describe('A copy', () => {
  it('is the rows themselves, not a summary of them', async () => {
    const res = await request(app)
      .get(`/api/family-members/${herMemberId}/orbit/privacy/export`)
      .set(auth(herToken));

    expect(res.status).toBe(200);
    const data = JSON.parse(res.text);

    expect(data.dailyCheckins).toHaveLength(3);
    expect(data.cycleRecords).toHaveLength(2);
    // The point of a copy is that it is the thing itself — her own
    // words included.
    expect(data.dailyCheckins[0].notes).toBe('nilijisikia vizuri');
    expect(data.exportedAt).toBeTruthy();
  });

  it('comes down as a file, not a page left open on a shared phone', async () => {
    const res = await request(app)
      .get(`/api/family-members/${herMemberId}/orbit/privacy/export`)
      .set(auth(herToken));

    expect(res.headers['content-disposition']).toMatch(/attachment; filename="orbit-/);
  });

  it('will not hand over somebody else', async () => {
    const res = await request(app)
      .get(`/api/family-members/${otherMemberId}/orbit/privacy/export`)
      .set(auth(herToken));

    expect([403, 404]).toContain(res.status);
  });
});

describe('Forgetting', () => {
  it('refuses a scope it does not recognise', async () => {
    const res = await request(app)
      .post(`/api/family-members/${herMemberId}/orbit/privacy/forget`)
      .set(auth(herToken))
      .send({ scope: 'EVERYTHING' });

    // There is no "everything": bookings, visits and invoices are the
    // business's records and the policy says they are kept. A schema
    // that accepted this and then spared half of it would promise more
    // than it did.
    expect(res.status).toBe(400);
  });

  it('cannot reach into another account', async () => {
    const res = await request(app)
      .post(`/api/family-members/${otherMemberId}/orbit/privacy/forget`)
      .set(auth(herToken))
      .send({ scope: 'ORBIT' });

    expect([403, 404]).toContain(res.status);

    // And the other woman's history is untouched. This is the
    // assertion that matters most in the file.
    const survived = await OrbitCheckin.count({ where: { familyMemberId: otherMemberId } });
    expect(survived).toBe(3);
  });

  it('removes only check-ins when only check-ins were asked for', async () => {
    const res = await request(app)
      .post(`/api/family-members/${herMemberId}/orbit/privacy/forget`)
      .set(auth(herToken))
      .send({ scope: 'CHECKINS' });

    expect(res.status).toBe(200);
    expect(res.body.data.removed.dailyCheckins).toBe(3);
    expect(res.body.data.removed.cycleRecords).toBe(0);

    expect(await OrbitCheckin.count({ where: { familyMemberId: herMemberId } })).toBe(0);
    expect(await MenstrualCycle.count({ where: { familyMemberId: herMemberId } })).toBe(2);
  });

  it('deletes for real, rather than hiding behind a flag', async () => {
    await seedTracking(herMemberId, { checkins: 2, cycles: 0 });

    await request(app)
      .post(`/api/family-members/${herMemberId}/orbit/privacy/forget`)
      .set(auth(herToken))
      .send({ scope: 'ORBIT' });

    // Counted straight off the tables, not through the service that
    // might be filtering them.
    const [checkins, cycles] = await Promise.all([
      OrbitCheckin.count({ where: { familyMemberId: herMemberId } }),
      MenstrualCycle.count({ where: { familyMemberId: herMemberId } }),
    ]);
    expect(checkins).toBe(0);
    expect(cycles).toBe(0);
  });

  it('records that it happened, without keeping what was deleted', async () => {
    const entries = await AuditLog.findAll({
      where: { entityId: herMemberId, action: 'ORBIT_DATA_DELETED' },
    });
    expect(entries.length).toBeGreaterThan(0);

    const metadata = JSON.stringify(entries.map((e) => e.metadata));
    // How many, and which scope — the business can show a deletion was
    // asked for and done.
    expect(metadata).toContain('scope');
    // But no shadow copy of the thing she asked it to forget.
    expect(metadata).not.toContain('nilijisikia vizuri');
    expect(metadata).not.toContain('cramps');
  });
});
