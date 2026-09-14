'use strict';

const service = require('../services/booking.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const booking = await service.create(req.user, req.body);
    return success(res, { statusCode: 201, message: 'Booking requested', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const bookings = await service.list(req.user, req.query);
    return success(res, { message: 'Bookings', data: { bookings } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    return success(res, { message: 'Booking', data: { booking: req.booking } });
  } catch (err) {
    next(err);
  }
}

async function suggestedStaff(req, res, next) {
  try {
    const candidates = await service.suggestedStaff(req.params.bookingId);
    return success(res, { message: 'Suggested staff', data: { candidates } });
  } catch (err) {
    next(err);
  }
}

async function assign(req, res, next) {
  try {
    const booking = await service.assign(req.params.bookingId, req.body.staffId, req.user, req);
    return success(res, { message: 'Booking assigned', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function accept(req, res, next) {
  try {
    const booking = await service.accept(req.params.bookingId, req.user, req);
    return success(res, { message: 'Booking accepted', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const booking = await service.reject(req.params.bookingId, req.body.reason, req.user, req);
    return success(res, { message: 'Booking rejected', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function onTheWay(req, res, next) {
  try {
    const booking = await service.onTheWay(req.params.bookingId, req.user, req);
    return success(res, { message: 'Booking marked on the way', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function arrive(req, res, next) {
  try {
    const booking = await service.arrive(req.params.bookingId, req.user, req);
    return success(res, { message: 'Booking marked arrived', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const booking = await service.start(req.params.bookingId, req.user, req);
    return success(res, { message: 'Visit started', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const booking = await service.complete(req.params.bookingId, req.user, req);
    return success(res, { message: 'Booking completed', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const booking = await service.cancel(req.params.bookingId, req.body.reason, req.user, req);
    return success(res, { message: 'Booking cancelled', data: { booking } });
  } catch (err) {
    next(err);
  }
}

async function reschedule(req, res, next) {
  try {
    const booking = await service.reschedule(req.params.bookingId, req.body.scheduledAt, req.user, req);
    return success(res, { message: 'Booking rescheduled', data: { booking } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getOne,
  suggestedStaff,
  assign,
  accept,
  reject,
  onTheWay,
  arrive,
  start,
  complete,
  cancel,
  reschedule,
};
