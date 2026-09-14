'use strict';

const service = require('../services/vitals.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const measurement = await service.create(req.familyMember.id, req.user.id, req.body);
    return success(res, { statusCode: 201, message: 'Vital recorded', data: { measurement } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const measurements = await service.list(req.familyMember.id, req.query);
    return success(res, { message: 'Vitals', data: { measurements } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const measurement = await service.getOne(req.familyMember.id, req.params.vitalId);
    return success(res, { message: 'Vital', data: { measurement } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const measurement = await service.update(req.familyMember.id, req.params.vitalId, req.body);
    return success(res, { message: 'Vital updated', data: { measurement } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.remove(req.familyMember.id, req.params.vitalId);
    return success(res, { message: 'Vital deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, update, remove };
