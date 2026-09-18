'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0731${suffix}`;
const otherPhone = `0732${suffix}`;
const staffPhone = `0733${suffix}`;

let clientToken;
let otherToken;
let staffToken;

afterAll(async () => {
  await User.destroy({ where: { phone: [clientPhone, otherPhone, staffPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Profile Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;

  const other = await request(app).post('/api/auth/register').send({
    name: 'Profile Other Client',
    phone: otherPhone,
    password: 'TestPass123',
  });
  otherToken = other.body.data.tokens.accessToken;

  const staff = await request(app).post('/api/auth/register').send({
    name: 'Profile Test Nurse',
    phone: staffPhone,
    password: 'TestPass123',
    role: 'STAFF',
    specialty: 'NURSE',
  });
  staffToken = staff.body.data.tokens.accessToken;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Client profile', () => {
  it('starts with a row and a sensible default city', async () => {
    const res = await request(app).get('/api/client-profile').set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.data.clientProfile.address).toBeNull();
    expect(res.body.data.clientProfile.city).toBe('Dar es Salaam');
  });

  it('saves an address and an emergency contact', async () => {
    const res = await request(app)
      .patch('/api/client-profile')
      .set(auth(clientToken))
      .send({
        address: 'Mtaa wa Kariakoo, nyumba namba 14',
        emergencyContactName: 'Neema Mushi',
        emergencyContactPhone: '0712345678',
        emergencyContactRelationship: 'Dada',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.clientProfile.address).toBe('Mtaa wa Kariakoo, nyumba namba 14');
    expect(res.body.data.clientProfile.emergencyContactPhone).toBe('0712345678');

    const after = await request(app).get('/api/client-profile').set(auth(clientToken));
    expect(after.body.data.clientProfile.emergencyContactName).toBe('Neema Mushi');
  });

  it('leaves the fields it was not given alone', async () => {
    const res = await request(app)
      .patch('/api/client-profile')
      .set(auth(clientToken))
      .send({ city: 'Mwanza' });
    expect(res.status).toBe(200);
    expect(res.body.data.clientProfile.city).toBe('Mwanza');
    // The address from the previous test is still there.
    expect(res.body.data.clientProfile.address).toBe('Mtaa wa Kariakoo, nyumba namba 14');
  });

  it('refuses an emergency number nobody could dial', async () => {
    const res = await request(app)
      .patch('/api/client-profile')
      .set(auth(clientToken))
      .send({ emergencyContactPhone: '12345' });
    expect(res.status).toBe(400);
  });

  it('keeps one client out of another client’s profile', async () => {
    // There is no id in the path to swap, so the only thing a second
    // client can reach is their own empty row.
    const res = await request(app).get('/api/client-profile').set(auth(otherToken));
    expect(res.status).toBe(200);
    expect(res.body.data.clientProfile.address).toBeNull();
  });

  it('is closed to staff, who have no client profile to keep', async () => {
    const res = await request(app).get('/api/client-profile').set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/client-profile');
    expect(res.status).toBe(401);
  });
});
