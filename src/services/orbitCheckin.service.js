'use strict';

const { Op } = require('sequelize');
const { OrbitCheckin } = require('../models');

// Saving and reading a day's check-in.
//
// Upsert on (person, day), because a person who opens Orbit twice in a
// morning is correcting today, not creating a second today. Only the
// keys that arrive are written — sending { energy: 2 } must not blank
// the mood they recorded an hour ago, which is the same merge rule the
// health profile follows and for the same reason.
//
// Nothing is ever deleted by an edit. The row for a past day keeps what
// was recorded on it; updated_at carries when it was last touched.

const FIELDS = ['mood', 'energy', 'sleep', 'appetite', 'pain', 'flow', 'symptoms', 'notes'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function save(familyMemberId, payload = {}) {
  const checkinDate = payload.checkinDate ?? today();

  const [row] = await OrbitCheckin.findOrCreate({
    where: { familyMemberId, checkinDate },
    defaults: { familyMemberId, checkinDate, symptoms: [] },
  });

  for (const field of FIELDS) {
    if (payload[field] !== undefined) row[field] = payload[field];
  }

  await row.save();
  return row;
}

async function getDay(familyMemberId, checkinDate) {
  return OrbitCheckin.findOne({ where: { familyMemberId, checkinDate } });
}

async function list(familyMemberId, { from, to, limit = 120 } = {}) {
  const where = { familyMemberId };
  if (from && to) where.checkinDate = { [Op.between]: [from, to] };
  else if (from) where.checkinDate = { [Op.gte]: from };
  else if (to) where.checkinDate = { [Op.lte]: to };

  return OrbitCheckin.findAll({
    where,
    order: [['checkinDate', 'DESC']],
    limit: Math.min(limit, 400),
  });
}

// What the app needs to decide whether to nudge: has today been done,
// and how many of the last seven days were.
async function streak(familyMemberId) {
  const rows = await list(familyMemberId, { limit: 14 });
  const dates = new Set(rows.map((r) => r.checkinDate));

  const day = 24 * 60 * 60 * 1000;
  let last7 = 0;
  for (let i = 0; i < 7; i += 1) {
    if (dates.has(new Date(Date.now() - i * day).toISOString().slice(0, 10))) last7 += 1;
  }

  return { doneToday: dates.has(today()), daysInLastWeek: last7 };
}

module.exports = { save, getDay, list, streak, today };
