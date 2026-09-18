'use strict';

const service = require('../services/clientProfile.service');
const { logAudit } = require('../services/audit.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const clientProfile = await service.getOrCreate(req.user.id);
    return success(res, { message: 'Client profile', data: { clientProfile } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const clientProfile = await service.update(req.user.id, req.body);
    // A home address and an emergency contact are worth a trail: they
    // say where a nurse will be sent and who gets called in a crisis.
    await logAudit({
      userId: req.user.id,
      action: 'CLIENT_PROFILE_UPDATED',
      entityType: 'ClientProfile',
      entityId: clientProfile.id,
      req,
    });
    return success(res, { message: 'Client profile updated', data: { clientProfile } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
