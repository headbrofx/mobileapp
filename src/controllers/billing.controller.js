'use strict';

const service = require('../services/billing.service');
const { ClientProfile } = require('../models');
const AppError = require('../utils/appError');
const { success } = require('../utils/apiResponse');

// A client may read their own invoices and nobody else's. Staff and
// admins raise them and take payment.
async function ownClientProfileId(req) {
  const profile = await ClientProfile.findOne({ where: { userId: req.user.id } });
  return profile ? profile.id : null;
}

async function assertMayRead(req, invoice) {
  if (req.user.role === 'ADMIN' || req.user.role === 'STAFF') return;
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
    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'STAFF';
    const clientProfileId = isStaff ? req.query.clientProfileId : await ownClientProfileId(req);

    // A client with no profile sees nothing rather than everything.
    if (!isStaff && !clientProfileId) {
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
    await assertMayRead(req, invoice);
    return success(res, { message: 'Invoice', data: { invoice } });
  } catch (err) {
    next(err);
  }
}

async function issue(req, res, next) {
  try {
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
