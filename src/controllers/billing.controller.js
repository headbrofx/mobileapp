'use strict';

const { Op } = require('sequelize');
const service = require('../services/billing.service');
const { ClientProfile, Staff, Booking } = require('../models');
const AppError = require('../utils/appError');
const { success } = require('../utils/apiResponse');

// Who may see an invoice.
//
//   ADMIN  — everything. They run the books.
//   STAFF  — invoices they raised, and invoices for a booking they were
//            assigned to. A nurse needs the bill for the patient in
//            front of them; they have no business reading every
//            family's finances, and in a city where people know each
//            other that distinction is not academic.
//   CLIENT — their own, and nothing else.
//
// This started out letting any staff member read any invoice, which was
// more access than the job needs.

async function ownClientProfileId(req) {
  const profile = await ClientProfile.findOne({ where: { userId: req.user.id } });
  return profile ? profile.id : null;
}

// The bookings this staff member is, or was, assigned to.
async function staffBookingIds(req) {
  const staff = await Staff.findOne({ where: { userId: req.user.id } });
  if (!staff) return [];
  const bookings = await Booking.findAll({ where: { staffId: staff.id }, attributes: ['id'] });
  return bookings.map((booking) => booking.id);
}

async function assertMayTouch(req, invoice) {
  if (req.user.role === 'ADMIN') return;

  if (req.user.role === 'STAFF') {
    if (invoice.createdBy === req.user.id) return;
    const bookingIds = await staffBookingIds(req);
    if (invoice.bookingId && bookingIds.includes(invoice.bookingId)) return;
    throw AppError.forbidden('You do not have access to this invoice');
  }

  const mine = await ownClientProfileId(req);
  if (!mine || invoice.clientProfileId !== mine) {
    throw AppError.forbidden('You do not have access to this invoice');
  }
}

async function create(req, res, next) {
  try {
    const invoice = await service.create(req.body, { userId: req.user.id, req });
    return success(res, { statusCode: 201, message: 'Invoice created as a draft', data: { invoice } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      const invoices = await service.list({
        clientProfileId: req.query.clientProfileId,
        status: req.query.status,
      });
      return success(res, { message: 'Invoices', data: { invoices } });
    }

    if (req.user.role === 'STAFF') {
      const bookingIds = await staffBookingIds(req);
      const invoices = await service.list({
        status: req.query.status,
        scope: {
          [Op.or]: [
            { createdBy: req.user.id },
            ...(bookingIds.length ? [{ bookingId: { [Op.in]: bookingIds } }] : []),
          ],
        },
      });
      return success(res, { message: 'Invoices', data: { invoices } });
    }

    const clientProfileId = await ownClientProfileId(req);
    // A client with no profile sees nothing rather than everything.
    if (!clientProfileId) {
      return success(res, { message: 'Invoices', data: { invoices: [] } });
    }

    const invoices = await service.list({ clientProfileId, status: req.query.status });
    return success(res, { message: 'Invoices', data: { invoices } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const invoice = await service.getOne(req.params.id);
    await assertMayTouch(req, invoice);
    return success(res, { message: 'Invoice', data: { invoice } });
  } catch (err) {
    next(err);
  }
}

async function issue(req, res, next) {
  try {
    await assertMayTouch(req, await service.getOne(req.params.id));
    const invoice = await service.issue(req.params.id, { userId: req.user.id, req });
    return success(res, { message: 'Invoice issued', data: { invoice } });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const invoice = await service.cancel(req.params.id, {
      reason: req.body.reason,
      userId: req.user.id,
      req,
    });
    return success(res, { message: 'Invoice cancelled', data: { invoice } });
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    // Taking money against an invoice is a write, so the same rule
    // applies as to reading one: a nurse may settle the bill for their
    // own patient, not for a stranger's.
    await assertMayTouch(req, await service.getOne(req.params.id));

    const invoice = await service.recordPayment(req.params.id, req.body, { userId: req.user.id, req });
    return success(res, {
      statusCode: 201,
      message: 'Payment recorded',
      data: {
        invoice,
        // Recorded by a person, not confirmed by a provider. Nothing
        // here has spoken to M-Pesa.
        gatewayConfirmed: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function outstanding(req, res, next) {
  try {
    const data = await service.outstanding();
    return success(res, { message: 'Outstanding balances', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, issue, cancel, recordPayment, outstanding };
