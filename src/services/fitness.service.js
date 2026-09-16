'use strict';

const { Op } = require('sequelize');
const { FitnessProfile, WorkoutLog, ActivityLog } = require('../models');
const AppError = require('../utils/appError');

// Fitness tracking.
//
// Calories burned are never estimated. The usual formula needs body
// weight and a MET value per exercise, and the answer it gives is a
// wide guess dressed as a number — so caloriesBurned is stored only
// when the user supplies it, the same rule the nutrition side follows.
//
// Weekly totals are reported and not compared against a target. Public
// activity guidelines are written for healthy adults, and a good share
// of the people this app serves are elderly, recovering from illness,
// or working through a rehab plan. Telling them they fell short of a
// number meant for somebody else is worse than telling them nothing.

const DAY_MS = 24 * 60 * 60 * 1000;

function dayBounds(dateOnly) {
  const [y, m, d] = String(dateOnly).slice(0, 10).split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// --- Profile ---

async function getProfile(familyMemberId) {
  const [profile] = await FitnessProfile.findOrCreate({
    where: { familyMemberId },
    defaults: { familyMemberId },
  });
  return profile;
}

async function updateProfile(familyMemberId, payload) {
  const profile = await getProfile(familyMemberId);
  await profile.update(payload);
  return profile.reload();
}

// --- Workouts ---

async function logWorkout(familyMemberId, payload) {
  return WorkoutLog.create({
    familyMemberId,
    ...payload,
    // Only ever what was supplied. Nothing here works it out.
    caloriesBurned: payload.caloriesBurned == null ? null : payload.caloriesBurned,
    loggedAt: payload.loggedAt || new Date(),
  });
}

async function listWorkouts(familyMemberId, { date = null, days = null } = {}) {
  const where = { familyMemberId };

  if (date) {
    const { start, end } = dayBounds(date);
    where.loggedAt = { [Op.between]: [start, end] };
  } else if (days) {
    where.loggedAt = { [Op.gte]: new Date(Date.now() - days * DAY_MS) };
  }

  return WorkoutLog.findAll({ where, order: [['loggedAt', 'DESC']], limit: 200 });
}

async function deleteWorkout(familyMemberId, workoutId) {
  const workout = await WorkoutLog.findOne({ where: { id: workoutId, familyMemberId } });
  if (!workout) throw AppError.notFound('Workout not found');
  await workout.destroy();
}

// --- Daily activity (steps) ---

// One row per day, so logging twice for the same date corrects it
// rather than double-counting a pedometer's running total.
async function upsertActivity(familyMemberId, { date, steps, distanceKm, activeMinutes }) {
  const [entry, created] = await ActivityLog.findOrCreate({
    where: { familyMemberId, date },
    defaults: { familyMemberId, date, steps, distanceKm, activeMinutes },
  });

  if (!created) {
    await entry.update({ steps, distanceKm, activeMinutes });
  }
  return entry.reload();
}

async function listActivity(familyMemberId, { days = 30 } = {}) {
  const since = isoDay(Date.now() - days * DAY_MS);
  return ActivityLog.findAll({
    where: { familyMemberId, date: { [Op.gte]: since } },
    order: [['date', 'DESC']],
    limit: 200,
  });
}

// --- Summary ---

async function summary(familyMemberId, { days = 7 } = {}) {
  const profile = await getProfile(familyMemberId);
  const workouts = await listWorkouts(familyMemberId, { days });
  const activity = await listActivity(familyMemberId, { days });

  const minutes = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  const byIntensity = workouts.reduce((acc, w) => {
    acc[w.intensity] = (acc[w.intensity] || 0) + 1;
    return acc;
  }, {});

  const withSteps = activity.filter((a) => a.steps != null);
  const totalSteps = withSteps.reduce((sum, a) => sum + a.steps, 0);
  const totalDistance = activity.reduce((sum, a) => sum + (a.distanceKm || 0), 0);

  const notes = [];
  if (profile.goal === 'REHAB') {
    // Rehab is a clinical plan, not a fitness habit. The app records
    // what was done; it does not decide what should be done.
    notes.push(
      'Lengo lako ni kupona. Mpango wa mazoezi unapaswa kutoka kwa muuguzi au mtaalamu wako, si kwa app hii. Orodha hii ni kumbukumbu tu.'
    );
  }

  return {
    periodDays: days,
    goal: profile.goal,
    activityLevel: profile.activityLevel,
    workouts: {
      count: workouts.length,
      totalMinutes: minutes,
      byIntensity,
      // Only what was logged by hand; nothing is estimated.
      caloriesBurnedLogged: workouts.some((w) => w.caloriesBurned != null)
        ? workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0)
        : null,
    },
    activity: {
      daysLogged: activity.length,
      totalSteps: withSteps.length ? totalSteps : null,
      averageStepsPerDay: withSteps.length ? Math.round(totalSteps / withSteps.length) : null,
      totalDistanceKm: activity.length ? Math.round(totalDistance * 10) / 10 : null,
    },
    // Totals only. There is no target here to fall short of.
    notes,
  };
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
