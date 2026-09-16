'use strict';

const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, ClientProfile, Invoice, Payment, InvoiceItem, AuditLog } = require('../src/models');

const suffix = Date.now().toString().slice(-6);
// 07x / 06x only — the validator holds to real Tanzanian numbering.
const clientPhone = `0711${suffix}`;
const otherClientPhone = `0712${suffix}`;

let clientToken;
let otherClientToken;
let adminToken;
let clientProfileId;
let invoiceId;
let invoiceNumber;

afterAll(async () => {
  // invoices.client_profile_id and payments.recorded_by are both
  // RESTRICT on purpose — books must not vanish because an account was
  // deleted — so the test's own rows come out in dependency order.
  const invoices = await Invoice.findAll({ where: { clientProfileId }, attributes: ['id'] });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  if (invoiceIds.length) {
    await Payment.destroy({ where: { invoiceId: invoiceIds } });
    await InvoiceItem.destroy({ where: { invoiceId: invoiceIds } });
    await Invoice.destroy({ where: { id: invoiceIds } });
  }
  await User.destroy({ where: { phone: [clientPhone, otherClientPhone] } });
  await sequelize.close();
});

beforeAll(async () => {
  const register = await request(app).post('/api/auth/register').send({
    name: 'Billing Test Client',
    phone: clientPhone,
    password: 'TestPass123',
  });
  clientToken = register.body.data.tokens.accessToken;
  const clientUserId = register.body.data.user.id;

  const otherRegister = await request(app).post('/api/auth/register').send({
    name: 'Billing Other Client',
    phone: otherClientPhone,
    password: 'TestPass123',
  });
  otherClientToken = otherRegister.body.data.tokens.accessToken;

  const adminLogin = await request(app).post('/api/auth/login').send({
    identifier: '0700000003',
    password: 'Password123!',
  });
  adminToken = adminLogin.body.data.tokens.accessToken;

  const profile = await ClientProfile.findOne({ where: { userId: clientUserId } });
  clientProfileId = profile.id;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Phase 14 — Raising an invoice', () => {
  it('computes the total from the lines and ignores any total sent', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({
        clientProfileId,
        items: [
          { description: 'Ziara ya uuguzi nyumbani', quantity: 3, unitPrice: 50000 },
          { description: 'Vifaa vya kuvalia jeraha', quantity: 1, unitPrice: 15000 },
        ],
        dueDate: '2026-10-15',
        // A number the client chose. It must not survive.
        amount: 1,
      });

    expect(res.status).toBe(201);
    invoiceId = res.body.data.invoice.id;
    invoiceNumber = res.body.data.invoice.number;

    expect(res.body.data.invoice.amount).toBe(165000);
    expect(res.body.data.invoice.items[0].amount).toBe(150000);
    expect(res.body.data.invoice.status).toBe('DRAFT');
    expect(res.body.data.invoice.currency).toBe('TZS');
    expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });

  it('gives every invoice its own number', async () => {
    const second = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({ clientProfileId, items: [{ description: 'Ziara moja', unitPrice: 50000 }] });

    expect(second.body.data.invoice.number).not.toBe(invoiceNumber);
    await Invoice.destroy({ where: { id: second.body.data.invoice.id } });
  });

  it('refuses fractional money and an invoice with no lines', async () => {
    const fractional = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({ clientProfileId, items: [{ description: 'Nusu shilingi', unitPrice: 1500.5 }] });
    expect(fractional.status).toBe(400);

    const empty = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({ clientProfileId, items: [] });
    expect(empty.status).toBe(400);
  });

  it('blocks a client from raising one', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(auth(clientToken))
      .send({ clientProfileId, items: [{ description: 'Bure', unitPrice: 0 }] });
    expect(res.status).toBe(403);
  });
});

describe('Phase 14 — Payments', () => {
  it('will not take payment against a draft', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(adminToken))
      .send({ amount: 1000, method: 'CASH' });
    expect(res.status).toBe(409);
  });

  it('issues the invoice and records who issued it', async () => {
    const res = await request(app).post(`/api/invoices/${invoiceId}/issue`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('ISSUED');
    expect(res.body.data.invoice.issuedAt).not.toBeNull();

    const audit = await AuditLog.findOne({ where: { action: 'INVOICE_ISSUED', entityId: invoiceId } });
    expect(audit).not.toBeNull();
  });

  it('takes a part payment and tracks the balance', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(adminToken))
      .send({ amount: 100000, method: 'MPESA', reference: 'QWE123RTY' });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.status).toBe('PARTIALLY_PAID');
    expect(res.body.data.invoice.amountPaid).toBe(100000);
    expect(res.body.data.invoice.balance).toBe(65000);

    // Keyed by a person, not confirmed by Vodacom. Nothing here has
    // spoken to a payment provider.
    expect(res.body.data.gatewayConfirmed).toBe(false);
    expect(res.body.data.invoice.payments[0].gatewayConfirmed).toBe(false);
    expect(res.body.data.invoice.payments[0].recordedBy).toBeTruthy();
  });

  it('refuses a payment larger than the balance', async () => {
    // Almost always a typo, and a typo that lands in the books costs
    // far more to undo than to reject.
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(adminToken))
      .send({ amount: 500000, method: 'CASH' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance of 65000/);
  });

  it('settles the invoice on the final payment', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(adminToken))
      .send({ amount: 65000, method: 'CASH' });

    expect(res.body.data.invoice.status).toBe('PAID');
    expect(res.body.data.invoice.balance).toBe(0);
  });

  it('will not take more once it is settled', async () => {
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(auth(adminToken))
      .send({ amount: 1000, method: 'CASH' });
    expect(res.status).toBe(409);
  });

  it('will not cancel an invoice that money has been paid against', async () => {
    // Cancelling would leave a payment attached to nothing. A refund is
    // a person's job first.
    const res = await request(app)
      .post(`/api/invoices/${invoiceId}/cancel`)
      .set(auth(adminToken))
      .send({ reason: 'Nimekosea' });
    expect(res.status).toBe(409);
  });

  it('cancels an untouched invoice', async () => {
    const created = await request(app)
      .post('/api/invoices')
      .set(auth(adminToken))
      .send({ clientProfileId, items: [{ description: 'Imefutwa', unitPrice: 20000 }] });
    const id = created.body.data.invoice.id;

    await request(app).post(`/api/invoices/${id}/issue`).set(auth(adminToken));
    const res = await request(app)
      .post(`/api/invoices/${id}/cancel`)
      .set(auth(adminToken))
      .send({ reason: 'Mteja ameghairi' });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('CANCELLED');
    expect(res.body.data.invoice.notes).toMatch(/Mteja ameghairi/);
  });
});

describe('Phase 14 — Who can see what', () => {
  it('lets a client read their own invoice', async () => {
    const res = await request(app).get(`/api/invoices/${invoiceId}`).set(auth(clientToken));
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.number).toBe(invoiceNumber);
  });

  it('blocks a different client from reading it', async () => {
    const res = await request(app).get(`/api/invoices/${invoiceId}`).set(auth(otherClientToken));
    expect(res.status).toBe(403);
  });

  it('scopes the list to the client who asked', async () => {
    const mine = await request(app).get('/api/invoices').set(auth(clientToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data.invoices.length).toBeGreaterThan(0);
    expect(mine.body.data.invoices.every((i) => i.clientProfileId === clientProfileId)).toBe(true);

    const theirs = await request(app).get('/api/invoices').set(auth(otherClientToken));
    expect(theirs.body.data.invoices.length).toBe(0);
  });

  it('keeps the outstanding report for admins only', async () => {
    const blocked = await request(app).get('/api/invoices/outstanding').set(auth(clientToken));
    expect(blocked.status).toBe(403);

    const res = await request(app).get('/api/invoices/outstanding').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe('TZS');
    expect(typeof res.body.data.totalOwed).toBe('number');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });
});
