'use strict';

// Fixes made after the Phase 17 audit, each with the test that would
// have caught it.

const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  ClientProfile,
  Invoice,
  InvoiceItem,
  Payment,
  Medication,
  MedicationDose,
} = require('../src/models');

const suffix = Date.now().toString().slice(-6);
const clientPhone = `0717${suffix}`;

let clientToken;
let staffToken;
let adminToken;
let clientProfileId;
let familyMemberId;
let invoiceId;

afterAll(async () => {
  const invoices = await Invoice.findAll({ where: { clientProfileId }, attributes: ['id'] });
  const ids = invoices.map((invoice) => invoice.id);
  if (ids.length) {
    await Payment.destroy({ where: { invoiceId: ids } });
    await InvoiceItem.destroy({ where: { invoiceId: ids } });
    await Invoice.destroy({ where: { id: ids } });
  }
  await User.destroy({ where: { phone: clientPhone } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Hardening Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;
  const clientUserId = register.body.data.user.id;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  // The seeded nurse, who has nothing to do with this client.
  const staffLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000002',
    password: 'Password123!',
  });
  staffToken = staffLogin.body.data.tokens.accessToken;

  const profile = await ClientProfile.findOne({ where: { userId: clientUserId } });
  clientProfileId = profile.id;

  const members = await request(app)
    .get('/api/family-members')
    .set({ Authorization: `Bearer ${clientToken}` });
  familyMemberId = members.body.data.familyMembers[0].id;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Hardening — a nurse sees the bills of their own patients only', () => {
  it('creates an invoice with no booking attached to it', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({ clientProfileId, items: [{ description: 'Ziara ya uuguzi', unitPrice: 50000 }] });

    expect(res.status).toBe(201);
    invoiceId = res.body.data.invoice.id;
  });

  it('refuses a staff member who neither raised it nor was assigned the visit', async () => {
    // This used to return 200: any staff account could read any
    // invoice, which is more access than the job needs.
    const res = await request(app).get(`/api/invoices/${invoiceId}`).set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  it('keeps it out of that staff member’s list as well', async () => {
    const res = await request(app).get('/api/invoices').set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.data.invoices.some((invoice) => invoice.id === invoiceId)).toBe(false);
  });

  it('refuses them taking payment against it, since that is a write', async () => {
    await request(app).post(`/api/invoices/${invoiceId}/issue`).set(auth(adminToken));

    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(staffToken))
      .send({ amount: 1000, method: 'CASH' });
    expect(res.status).toBe(403);
  });

  it('still lets the admin and the client themselves see it', async () => {
    const asAdmin = await request(app).get(`/api/invoices/${invoiceId}`).set(auth(adminToken));
    expect(asAdmin.status).toBe(200);

    const asClient = await request(app).get(`/api/invoices/${invoiceId}`).set(auth(clientToken));
    expect(asClient.status).toBe(200);
  });

  it('lets a staff member read an invoice they raised themselves', async () => {
    const created = await request(app)
      .post('/api/invoices')
      .set(auth(staffToken))
      .send({ clientProfileId, items: [{ description: 'Ziara nyingine', unitPrice: 30000 }] });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/invoices/${created.body.data.invoice.id}`)
      .set(auth(staffToken));
    expect(res.status).toBe(200);
  });
});

describe('Hardening — overdue doses are swept before what is due is reported', () => {
  it('marks a dose nobody answered as missed, without waiting for the adherence screen', async () => {
    const created = await request(app)
      .post(`/api/family-members/${familyMemberId}/medications`)
      .set(auth(clientToken))
      .send({
        name: 'Paracetamol',
        dosage: '500mg',
        scheduleTimes: ['08:00'],
        startDate: new Date().toISOString().slice(0, 10),
      });
    expect(created.status).toBe(201);
    const medicationId = created.body.data.medication.id;

    // A slot whose time has long gone and which nobody answered.
    const stale = await MedicationDose.create({
      medicationId,
      familyMemberId,
      scheduledFor: new Date(Date.now() - 48 * 60 * 60 * 1000),
      status: 'PENDING',
    });

    // Reading what is due used to leave it sitting at PENDING for good
    // unless somebody happened to open the adherence screen, and "due"
    // quietly started including the day before yesterday.
    await request(app)
      .get(`/api/family-members/${familyMemberId}/medications/due`)
      .set(auth(clientToken));

    const after = await MedicationDose.findByPk(stale.id);
    expect(after.status).toBe('MISSED');

    await MedicationDose.destroy({ where: { medicationId } });
    await Medication.destroy({ where: { id: medicationId } });
  });
});
