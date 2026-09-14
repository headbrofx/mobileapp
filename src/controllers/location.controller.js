'use strict';

const service = require('../services/location.service');
const { success } = require('../utils/apiResponse');

async function recordPing(req, res, next) {
  try {
    const ping = await service.recordPing(req.params.bookingId, req.body, req.user, req);
    return success(res, { statusCode: 201, message: 'Location recorded', data: { ping } });
  } catch (err) {
    next(err);
  }
}

async function getCurrent(req, res, next) {
  try {
    const location = await service.getCurrent(req.params.bookingId);
    return success(res, { message: 'Current location', data: location });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const pings = await service.getHistory(req.params.bookingId, req.query);
    return success(res, { message: 'Location history', data: { pings } });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordPing, getCurrent, getHistory };
