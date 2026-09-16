'use strict';

const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Payment, ClientProfile, Booking, sequelize } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

// Billing.
//
// There is no live payment gateway here, and that is a limitation
// rather than a design choice: M-Pesa, Tigo Pesa and Airtel Money each
// need a merchant account and a commercial agreement that the business
// does not have yet. What this does is keep the books — invoices, what
// is owed, what has been received and who took it — so that when a
// gateway is added it has somewhere to write to.
//
// Every payment row carries gatewayConfirmed false until a provider
// actually confirms one. A manually keyed entry must never be read as
// money verified by Vodacom.
//
// Money rules that are not negotiable:
//   * Amounts are whole shillings held as integers. 0.1 + 0.2 is not
//     0.3 in binary floating point, and an invoice that disagrees with
//     itself is a lost afternoon and a lost customer.
//   * Totals are computed on the server from the line items. A total
//     the client sent is a number the client chose.
//   * An issued invoice's lines are frozen. Correcting one means
//     cancelling it and raising another, so the paper trail survives.

async function nextInvoiceNumber() {
  // From a sequence, not COUNT(*)+1: two invoices raised in the same
  // second must never share a number.
  const [[row]] = await sequelize.query("SELECT nextval('invoice_number_seq') AS n");
  const year = new Date().getFullYear();
  return `INV-${year}-${String(row.n).padStart(6, '0')}`;
}

function computeItems(items) {
  return items.map((item) => {
    const quantity = item.quantity == null ? 1 : item.quantity;
    return {
      description: item.description,
      quantity,
      unitPrice: item.unitPrice,
      // Worked out here, every time, from quantity and unit price.
      amount: quantity * item.unitPrice,
    };
  });
}

async function totalPaid(invoiceId) {
  const paid = await Payment.sum('amount', { where: { invoiceId } });
  return paid || 0;
}

async function withTotals(invoice) {
  const paid = await totalPaid(invoice.id);
  const plain = invoice.toJSON();
  return { ...plain, amountPaid: paid, balance: invoice.amount - paid };
}

async function create({ clientProfileId, bookingId = null, items, dueDate = null, notes = null }, { userId, req }) {
  const client = await ClientProfile.findByPk(clientProfileId);
  if (!client) throw AppError.badRequest('That client does not exist');

  if (bookingId) {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) throw AppError.badRequest('That booking does not exist');
  }

  const computed = computeItems(items);
  const amount = computed.reduce((sum, item) => sum + item.amount, 0);

  const invoice = await Invoice.create({
    number: await nextInvoiceNumber(),
    clientProfileId,
    bookingId,
    amount,
    dueDate,
    notes,
    createdBy: userId,
    status: 'DRAFT',
  });

  await InvoiceItem.bulkCreate(computed.map((item) => ({ ...item, invoiceId: invoice.id })));

  await logAudit({
    userId,
    action: 'INVOICE_CREATED',
    entityType: 'Invoice',
    entityId: invoice.id,
    req,
    metadata: { number: invoice.number, amount },
  });

  return getOne(invoice.id);
}

async function getOne(id) {
  const invoice = await Invoice.findByPk(id, {
    include: [
      { model: InvoiceItem, as: 'items' },
      { model: Payment, as: 'payments' },
    ],
    order: [[{ model: InvoiceItem, as: 'items' }, 'createdAt', 'ASC']],
  });
  if (!invoice) throw AppError.notFound('Invoice not found');
  return withTotals(invoice);
}

async function list({ clientProfileId = null, status = null, scope = null } = {}) {
  const where = {};
  if (clientProfileId) where.clientProfileId = clientProfileId;
  if (status) where.status = status;
  // An extra clause from the caller, used to narrow a staff member to
  // the invoices they raised or were assigned to. Merged rather than
  // replacing, so it can only ever narrow the result.
  if (scope) Object.assign(where, scope);

  const invoices = await Invoice.findAll({
    where,
    include: [{ model: InvoiceItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });

  return Promise.all(invoices.map(withTotals));
}

async function issue(id, { userId, req }) {
  const invoice = await Invoice.findByPk(id, { include: [{ model: InvoiceItem, as: 'items' }] });
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status !== 'DRAFT') throw AppError.conflict('Only a draft invoice can be issued');
  if (!invoice.items || invoice.items.length === 0) {
    throw AppError.badRequest('An invoice with no lines cannot be issued');
  }

  invoice.status = 'ISSUED';
  invoice.issuedAt = new Date();
  await invoice.save();

  await logAudit({
    userId,
    action: 'INVOICE_ISSUED',
    entityType: 'Invoice',
    entityId: invoice.id,
    req,
    metadata: { number: invoice.number, amount: invoice.amount },
  });

  return getOne(invoice.id);
}

async function cancel(id, { reason, userId, req }) {
  const invoice = await Invoice.findByPk(id);
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status === 'CANCELLED') throw AppError.conflict('Already cancelled');

  const paid = await totalPaid(invoice.id);
  if (paid > 0) {
    // Money has changed hands. Making the invoice disappear would leave
    // a payment attached to nothing, so a refund has to be handled by a
    // person first.
    throw AppError.conflict('This invoice has payments against it and cannot be cancelled');
  }

  invoice.status = 'CANCELLED';
  invoice.notes = reason ? `${invoice.notes || ''}\nCancelled: ${reason}`.trim() : invoice.notes;
  await invoice.save();

  await logAudit({
    userId,
    action: 'INVOICE_CANCELLED',
    entityType: 'Invoice',
    entityId: invoice.id,
    req,
    metadata: { number: invoice.number, reason },
  });

  return getOne(invoice.id);
}

async function recordPayment(id, { amount, method, reference = null, paidAt = null, note = null }, { userId, req }) {
  const invoice = await Invoice.findByPk(id);
  if (!invoice) throw AppError.notFound('Invoice not found');

  if (invoice.status === 'DRAFT') {
    throw AppError.conflict('This invoice has not been issued yet');
  }
  if (invoice.status === 'CANCELLED') {
    throw AppError.conflict('This invoice was cancelled');
  }

  const paid = await totalPaid(invoice.id);
  const balance = invoice.amount - paid;

  if (balance <= 0) throw AppError.conflict('This invoice is already settled');
  if (amount > balance) {
    // Refused rather than accepted and carried as a credit. An
    // overpayment is nearly always a typo, and a typo that lands in the
    // books is far more work to undo than to reject.
    throw AppError.badRequest(`That is more than the balance of ${balance} ${invoice.currency}`);
  }

  const payment = await Payment.create({
    invoiceId: invoice.id,
    amount,
    method,
    reference,
    paidAt: paidAt || new Date(),
    recordedBy: userId,
    note,
    // Nothing has confirmed this with a provider.
    gatewayConfirmed: false,
  });

  const nowPaid = paid + amount;
  invoice.status = nowPaid >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID';
  await invoice.save();

  await logAudit({
    userId,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: payment.id,
    req,
    metadata: { invoice: invoice.number, amount, method, balanceAfter: invoice.amount - nowPaid },
  });

  return getOne(invoice.id);
}

// What is owed, for the admin dashboard.
async function outstanding() {
  const invoices = await Invoice.findAll({
    where: { status: { [Op.in]: ['ISSUED', 'PARTIALLY_PAID'] } },
    include: [{ model: Payment, as: 'payments' }],
    order: [['dueDate', 'ASC']],
    limit: 500,
  });

  const today = new Date().toISOString().slice(0, 10);
  let totalOwed = 0;
  let overdueOwed = 0;

  const rows = invoices.map((invoice) => {
    const paid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.amount - paid;
    const overdue = Boolean(invoice.dueDate && invoice.dueDate < today);

    totalOwed += balance;
    if (overdue) overdueOwed += balance;

    return {
      id: invoice.id,
      number: invoice.number,
      clientProfileId: invoice.clientProfileId,
      amount: invoice.amount,
      amountPaid: paid,
      balance,
      dueDate: invoice.dueDate,
      overdue,
      status: invoice.status,
    };
  });

  return { currency: 'TZS', invoices: rows, totalOwed, overdueOwed, count: rows.length };
}

module.exports = { create, getOne, list, issue, cancel, recordPayment, outstanding, totalPaid };
