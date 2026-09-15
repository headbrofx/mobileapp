'use strict';

const service = require('../services/orbit.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const cycle = await service.create(req.familyMember.id, req.body);
    return success(res, { statusCode: 201, message: 'Cycle recorded', data: { cycle } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const cycles = await service.list(req.familyMember.id);
    return success(res, { message: 'Cycles', data: { cycles } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const cycle = await service.getOne(req.familyMember.id, req.params.cycleId);
    return success(res, { message: 'Cycle', data: { cycle } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const cycle = await service.update(req.familyMember.id, req.params.cycleId, req.body);
    return success(res, { message: 'Cycle updated', data: { cycle } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.remove(req.familyMember.id, req.params.cycleId);
    return success(res, { message: 'Cycle deleted' });
  } catch (err) {
    next(err);
  }
}

async function insights(req, res, next) {
  try {
    const data = await service.insights(req.familyMember.id);
    return success(res, { message: 'Orbit insights', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, update, remove, insights };
