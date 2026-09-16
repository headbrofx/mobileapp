'use strict';

const service = require('../services/medication.service');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const medication = await service.create(req.familyMember.id, req.body, { userId: req.user.id, req });
    return success(res, { statusCode: 201, message: 'Medication added', data: { medication } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const medications = await service.list(req.familyMember.id, { status: req.query.status });
    return success(res, { message: 'Medications', data: { medications } });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const medication = await service.getOne(req.familyMember.id, req.params.medicationId);
    return success(res, { message: 'Medication', data: { medication } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const medication = await service.update(req.familyMember.id, req.params.medicationId, req.body, {
      userId: req.user.id,
      req,
    });
    return success(res, { message: 'Medication updated', data: { medication } });
  } catch (err) {
    next(err);
  }
}

async function listDoses(req, res, next) {
  try {
    const doses = await service.listDoses(req.familyMember.id, {
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
    });
    return success(res, { message: 'Doses', data: { doses } });
  } catch (err) {
    next(err);
  }
}

async function dueDoses(req, res, next) {
  try {
    const doses = await service.dueDoses(req.familyMember.id, {
      hours: req.query.hours ? Number(req.query.hours) : 24,
    });
    return success(res, {
      message: 'Doses due',
      data: {
        doses,
        // No SMS or push is sent from the server — there is no gateway
        // budget. The client app schedules local notifications from this.
        deliveredByServer: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function markDose(req, res, next) {
  try {
    const dose = await service.markDose(req.familyMember.id, req.params.doseId, req.body);
    return success(res, { message: 'Dose recorded', data: { dose } });
  } catch (err) {
    next(err);
  }
}

async function adherence(req, res, next) {
  try {
    const data = await service.adherence(req.familyMember.id, {
      days: req.query.days ? Number(req.query.days) : 7,
    });
    return success(res, { message: 'Medication adherence', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, update, listDoses, dueDoses, markDose, adherence };
