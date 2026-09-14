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

module.exports = { listAuditLogs };
