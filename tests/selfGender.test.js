'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

// Gender, and the /auth/me payload the app draws its navigation from.
//
// Orbit is a women's health module and is shown on the strength of the
// gender recorded on the client's own SELF family member. That makes
// this a navigation contract, not just a field: if `self` stops coming
// back from /auth/me, or comes back without a gender, the tab bar
// silently stops offering Orbit to the people it is for — and no
// screen throws, so nothing else would catch it.
//
// The other half worth holding down is that gender stays optional.
// Registration must never fail for want of it.

const suffix = Date.now().toString().slice(-6);
const womanPhone = `0795${suffix}`;
const quietPhone = `0796${suffix}`;

async function registerClient(phone, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Gender Test Client', phone, password: 'TestPass123', ...extra });
  return res;
}

const meFor = (token) =>
  request(app).get('/api/auth/me').set({ Authorization: `Bearer ${token}` });

afterAll(async () => {
  await User.destroy({ where: { phone: [womanPhone, quietPhone] } });
  await sequelize.close();
});

describe('Gender at registration', () => {
  it('records it on the SELF member and hands it back on /auth/me', async () => {
    const register = await registerClient(womanPhone, { gender: 'FEMALE' });
    expect(register.status).toBe(201);

    const res = await meFor(register.body.data.tokens.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.self).toBeTruthy();
    expect(res.body.data.self.gender).toBe('FEMALE');
    // The app patches this member when the answer changes, so the id
    // has to travel with it.
    expect(res.body.data.self.id).toBeDefined();
  });

  it('leaves it null when nobody was asked, rather than guessing', async () => {
    const register = await registerClient(quietPhone);
    expect(register.status).toBe(201);

    const res = await meFor(register.body.data.tokens.accessToken);

    expect(res.body.data.self.gender).toBeNull();
  });

  it('refuses a value that is not one of the three', async () => {
    const res = await registerClient(`0797${suffix}`, { gender: 'LADY' });
    expect(res.status).toBe(400);
  });
});

describe('Changing the answer', () => {
  it('is patchable on the SELF member, and /auth/me follows', async () => {
    const register = await registerClient(quietPhone.replace('0796', '0794'));
    const token = register.body.data.tokens.accessToken;
    const auth = { Authorization: `Bearer ${token}` };

    const before = await meFor(token);
    expect(before.body.data.self.gender).toBeNull();

    // Exactly what the profile screen sends: gender alone, no
    // relationship — the SELF row must keep being SELF.
    const patch = await request(app)
      .patch(`/api/family-members/${before.body.data.self.id}`)
      .set(auth)
      .send({ gender: 'FEMALE' });
    expect(patch.status).toBe(200);

    const after = await meFor(token);
    expect(after.body.data.self.gender).toBe('FEMALE');
    expect(after.body.data.self.id).toBe(before.body.data.self.id);

    await User.destroy({ where: { phone: quietPhone.replace('0796', '0794') } });
  });
});

describe('Who has a self at all', () => {
  it('gives staff none, because Orbit is not theirs to be offered', async () => {
    const phone = `0793${suffix}`;
    const register = await registerClient(phone, { role: 'STAFF', specialty: 'NURSE' });
    const res = await meFor(register.body.data.tokens.accessToken);

    expect(res.body.data.self).toBeNull();

    await User.destroy({ where: { phone } });
  });
});
