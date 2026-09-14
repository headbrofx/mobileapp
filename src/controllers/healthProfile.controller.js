'use strict';

const service = require('../services/healthProfile.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const profile = await service.getOrCreate(req.familyMember.id);
    return success(res, { message: 'Health profile', data: { healthProfile: profile } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const profile = await service.update(req.familyMember.id, req.body);
    return success(res, { message: 'Health profile updated', data: { healthProfile: profile } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
