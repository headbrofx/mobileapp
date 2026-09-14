'use strict';

const staffService = require('../services/staff.service');
const bookingService = require('../services/booking.service');
const { success } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const staff = await staffService.listStaff({ status: req.query.status });
    return success(res, { message: 'Staff list', data: { staff } });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const staff = await staffService.getMyProfile(req.user.id);
    return success(res, { message: 'Your staff profile', data: { staff } });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const staff = await staffService.updateMyProfile(req.user.id, req.body, req);
    return success(res, { message: 'Staff profile updated', data: { staff } });
  } catch (err) {
    next(err);
  }
}

async function mySchedule(req, res, next) {
  try {
    const bookings = await bookingService.mySchedule(req.user, req.query);
    return success(res, { message: 'Your schedule', data: { bookings } });
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const staff = await staffService.approveStaff(req.params.id, req);
    return success(res, { message: 'Staff approved', data: { staff } });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const staff = await staffService.rejectStaff(req.params.id, req.body.reason, req);
    return success(res, { message: 'Staff rejected', data: { staff } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, me, updateMe, mySchedule, approve, reject };
