'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const googleService = require('../src/services/google.service');

// Google sign-in, with the network stubbed out.
//
// verifyIdToken is the only thing that talks to Google, so it is the
// only thing replaced. Everything below it — the subject match, the
// email link, the phone requirement, the account rows — is the real
// code path. Stubbing any deeper would be testing the stub.

const suffix = Date.now().toString().slice(-6);
const googlePhone = `0741${suffix}`;
const existingPhone = `0742${suffix}`;
const takenPhone = `0743${suffix}`;

const googleEmail = `google.${suffix}@example.com`;
const existingEmail = `existing.${suffix}@example.com`;

const SUB_NEW = `sub-new-${suffix}`;
const SUB_EXISTING = `sub-existing-${suffix}`;

let realVerify;

beforeAll(() => {
  realVerify = googleService.verifyIdToken;
});

afterAll(async () => {
  googleService.verifyIdToken = realVerify;
  await User.destroy({ where: { phone: [googlePhone, existingPhone, takenPhone] } });
  await sequelize.close();
});

function stubGoogle({ sub, email, name }) {
  googleService.verifyIdToken = async () => ({ sub, email, name });
}

describe('Google sign-in', () => {
  it('asks for a phone number before creating an account', async () => {
    stubGoogle({ sub: SUB_NEW, email: googleEmail, name: 'Google Newcomer' });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) });

    // A home-visit service cannot hold a client it has no number for,
    // and Google does not supply one.
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHONE_REQUIRED');
    expect(res.body.errors.email).toBe(googleEmail);
  });

  it('creates the account once the number is given', async () => {
    stubGoogle({ sub: SUB_NEW, email: googleEmail, name: 'Google Newcomer' });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'x'.repeat(30), phone: googlePhone });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.phone).toBe(googlePhone);
    // Neither the hash nor the Google id has any business leaving.
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.googleSub).toBeUndefined();
  });

  it('gives that account its own health record, like any other', async () => {
    stubGoogle({ sub: SUB_NEW, email: googleEmail, name: 'Google Newcomer' });
    const signIn = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'x'.repeat(30) });

    const token = signIn.body.data.tokens.accessToken;
    const members = await request(app)
      .get('/api/family-members')
      .set({ Authorization: `Bearer ${token}` });

    expect(members.status).toBe(200);
    expect(members.body.data.familyMembers[0].relationship).toBe('SELF');
  });

  it('returns the same account on the second visit, without asking again', async () => {
    stubGoogle({ sub: SUB_NEW, email: googleEmail, name: 'Google Newcomer' });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe(googlePhone);
  });

  it('links an account that already registered by phone', async () => {
    // Somebody who signed up with a password and the same address, then
    // later pressed the Google button, must land in their own account
    // rather than a second one.
    await request(app).post('/api/auth/register').send({
      name: 'Existing Client',
      phone: existingPhone,
      email: existingEmail,
      password: 'TestPass123',
    });

    stubGoogle({ sub: SUB_EXISTING, email: existingEmail, name: 'Existing Client' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'x'.repeat(30) });

    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe(existingPhone);
  });

  it('refuses a phone number somebody else already holds', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Phone Holder',
      phone: takenPhone,
      password: 'TestPass123',
    });

    stubGoogle({ sub: `sub-clash-${suffix}`, email: `clash.${suffix}@example.com`, name: 'Clasher' });
    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'x'.repeat(30), phone: takenPhone });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('refuses a phone number in a shape nobody could dial', async () => {
    stubGoogle({ sub: `sub-bad-${suffix}`, email: `bad.${suffix}@example.com`, name: 'Bad Phone' });
    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'x'.repeat(30), phone: '12345' });

    expect(res.status).toBe(400);
  });

  it('will not let a Google-only account be entered with a password', async () => {
    // The account created above has no password at all. Comparing a
    // guess against null must not be treated as a match.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: googlePhone, password: 'anything-at-all' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Google/);
  });

  it('rejects a token with no audience configured', async () => {
    googleService.verifyIdToken = realVerify;
    const config = require('../src/config/env');
    const saved = config.googleClientIds;
    config.googleClientIds = [];

    try {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ idToken: 'x'.repeat(30) });
      // With nothing to check the audience against there is no safe way
      // to accept the token, so it fails rather than trusting it.
      expect(res.status).toBe(400);
    } finally {
      config.googleClientIds = saved;
    }
  });
});
