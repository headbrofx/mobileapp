'use strict';

const service = require('../services/symptom.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const result = await service.create(req.familyMember.id, req.body);
    return success(res, { statusCode: 201, message: 'Symptom recorded', data: { symptom: result } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const symptoms = await service.list(req.familyMember.id, req.query);
    return success(res, { message: 'Symptoms', data: { symptoms } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const result = await service.getOne(req.familyMember.id, req.params.symptomId);
    return success(res, { message: 'Symptom', data: { symptom: result } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await service.update(req.familyMember.id, req.params.symptomId, req.body);
    return success(res, { message: 'Symptom updated', data: { symptom: result } });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.remove(req.familyMember.id, req.params.symptomId);
    return success(res, { message: 'Symptom deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, update, remove };
