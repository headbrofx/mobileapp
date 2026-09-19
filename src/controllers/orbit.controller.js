'use strict';

const service = require('../services/orbit.service');
const checkins = require('../services/orbitCheckin.service');
const patternsService = require('../services/orbitPatterns.service');
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

// --- Daily check-in ---

async function saveCheckin(req, res, next) {
  try {
    const checkin = await checkins.save(req.familyMember.id, req.body);
    return success(res, { message: 'Check-in saved', data: { checkin } });
  } catch (err) {
    next(err);
  }
}

async function listCheckins(req, res, next) {
  try {
    const rows = await checkins.list(req.familyMember.id, {
      from: req.query.from,
      to: req.query.to,
    });
    const streak = await checkins.streak(req.familyMember.id);
    return success(res, { message: 'Check-ins', data: { checkins: rows, streak } });
  } catch (err) {
    next(err);
  }
}

async function todayCheckin(req, res, next) {
  try {
    const checkin = await checkins.getDay(req.familyMember.id, checkins.today());
    const streak = await checkins.streak(req.familyMember.id);
    return success(res, { message: "Today's check-in", data: { checkin, streak } });
  } catch (err) {
    next(err);
  }
}

// --- What Orbit has noticed ---

async function patterns(req, res, next) {
  try {
    const data = await patternsService.patterns(req.familyMember.id);
    return success(res, { message: 'Patterns', data: { patterns: data } });
  } catch (err) {
    next(err);
  }
}

async function insight(req, res, next) {
  try {
    const data = await patternsService.todayInsight(req.familyMember.id);
    return success(res, { message: "Today's insight", data: { insight: data } });
  } catch (err) {
    next(err);
  }
}

async function report(req, res, next) {
  try {
    const data = await patternsService.monthlyReport(req.familyMember.id, {
      year: req.query.year ? Number(req.query.year) : undefined,
      month: req.query.month ? Number(req.query.month) : undefined,
    });
    return success(res, { message: 'Monthly report', data: { report: data } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  saveCheckin,
  listCheckins,
  todayCheckin,
  patterns,
  insight,
  report,
  create,
  list,
  getOne,
  update,
  remove,
  insights,
};
