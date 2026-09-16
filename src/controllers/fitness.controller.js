'use strict';

const service = require('../services/fitness.service');
const { success } = require('../utils/apiResponse');

async function getProfile(req, res, next) {
  try {
    const profile = await service.getProfile(req.familyMember.id);
    return success(res, { message: 'Fitness profile', data: { profile } });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await service.updateProfile(req.familyMember.id, req.body);
    return success(res, { message: 'Fitness profile updated', data: { profile } });
  } catch (err) {
    next(err);
  }
}

async function logWorkout(req, res, next) {
  try {
    const workout = await service.logWorkout(req.familyMember.id, req.body);
    return success(res, { statusCode: 201, message: 'Workout logged', data: { workout } });
  } catch (err) {
    next(err);
  }
}

async function listWorkouts(req, res, next) {
  try {
    const workouts = await service.listWorkouts(req.familyMember.id, {
      date: req.query.date,
      days: req.query.days ? Number(req.query.days) : null,
    });
    return success(res, { message: 'Workouts', data: { workouts } });
  } catch (err) {
    next(err);
  }
}

async function deleteWorkout(req, res, next) {
  try {
    await service.deleteWorkout(req.familyMember.id, req.params.workoutId);
    return success(res, { message: 'Workout deleted' });
  } catch (err) {
    next(err);
  }
}

async function upsertActivity(req, res, next) {
  try {
    const activity = await service.upsertActivity(req.familyMember.id, req.body);
    return success(res, { message: 'Daily activity recorded', data: { activity } });
  } catch (err) {
    next(err);
  }
}

async function listActivity(req, res, next) {
  try {
    const activity = await service.listActivity(req.familyMember.id, {
      days: req.query.days ? Number(req.query.days) : 30,
    });
    return success(res, { message: 'Daily activity', data: { activity } });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const data = await service.summary(req.familyMember.id, {
      days: req.query.days ? Number(req.query.days) : 7,
    });
    return success(res, { message: 'Fitness summary', data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  logWorkout,
  listWorkouts,
  deleteWorkout,
  upsertActivity,
  listActivity,
  summary,
};
