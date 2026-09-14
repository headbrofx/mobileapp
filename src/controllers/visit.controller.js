'use strict';

const service = require('../services/visit.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const visit = await service.getByBooking(req.params.bookingId);
    return success(res, { message: 'Visit', data: { visit } });
  } catch (err) {
    next(err);
  }
}

async function checkIn(req, res, next) {
  try {
    const visit = await service.checkIn(req.params.bookingId, req.user, req);
    return success(res, { statusCode: 201, message: 'Checked in — visit started', data: { visit } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const visit = await service.update(req.params.bookingId, req.body, req.user, req);
    return success(res, { message: 'Visit updated', data: { visit } });
  } catch (err) {
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const visit = await service.checkOut(req.params.bookingId, req.body, req.user, req);
    return success(res, { message: 'Checked out — visit and booking completed', data: { visit } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, checkIn, update, checkOut };
