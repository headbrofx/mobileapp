'use strict';

const { AuditLog, User } = require('../models');
const { success } = require('../utils/apiResponse');

async function listAuditLogs(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 25, 100);

    const { rows, count } = await AuditLog.findAndCountAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(req.query.action ? { where: { action: req.query.action } } : {}),
    });

    return success(res, {
      message: 'Audit logs',
      data: { logs: rows },
      meta: { page, pageSize, total: count },
    });
  } catch (err) {
    next(err);
  }
}

const adminService = require('../services/admin.service');

async function dashboard(req, res, next) {
  try {
    const data = await adminService.dashboard();
    return success(res, { message: 'Operations dashboard', data });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await adminService.listUsers({
      role: req.query.role,
      status: req.query.status,
      q: req.query.q,
    });
    return success(res, { message: 'Users', data: { users } });
  } catch (err) {
    next(err);
  }
}

async function setUserStatus(req, res, next) {
  try {
    const user = await adminService.setUserStatus(req.params.id, {
      status: req.body.status,
      actor: req.user,
      req,
    });
    return success(res, { message: 'Account status updated', data: { user } });
  } catch (err) {
    next(err);
  }
}

async function setUserRole(req, res, next) {
  try {
    const user = await adminService.setUserRole(req.params.id, {
      role: req.body.role,
      actor: req.user,
      req,
    });
    return success(res, { message: 'Role updated', data: { user } });
  } catch (err) {
    next(err);
  }
}

async function listStaff(req, res, next) {
  try {
    const staff = await adminService.listStaff({ approvalStatus: req.query.approvalStatus });
    return success(res, { message: 'Staff', data: { staff } });
  } catch (err) {
    next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const bookings = await adminService.listBookings({
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
    });
    return success(res, { message: 'Bookings', data: { bookings } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAuditLogs,
  dashboard,
  listUsers,
  setUserStatus,
  setUserRole,
  listStaff,
  listBookings,
};
