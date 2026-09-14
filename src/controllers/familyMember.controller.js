'use strict';

const service = require('../services/familyMember.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const familyMember = await service.createFamilyMember(req.user.id, req.body);
    return success(res, { statusCode: 201, message: 'Family member added', data: { familyMember } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const familyMembers = await service.listFamilyMembers(req.user.id);
    return success(res, { message: 'Family members', data: { familyMembers } });
  } catch (err) {
    next(err);
  }
}

async function get(req, res, next) {
  try {
    return success(res, { message: 'Family member', data: { familyMember: req.familyMember } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const familyMember = await service.updateFamilyMember(req.familyMember, req.body);
    return success(res, { message: 'Family member updated', data: { familyMember } });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, get, update };
