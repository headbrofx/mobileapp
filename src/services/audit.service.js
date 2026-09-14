'use strict';

const { AuditLog } = require('../models');
const logger = require('../config/logger');

// Fire-and-forget audit trail write. Never throws into the caller's flow
// — a logging failure must not break login/register/etc.
async function logAudit({ userId = null, action, entityType = null, entityId = null, req = null, metadata = {} }) {
  try {
    await AuditLog.create({
      userId,
      action,
      entityType,
      entityId,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { action, message: err.message });
  }
}

module.exports = { logAudit };
