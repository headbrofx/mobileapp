'use strict';

const { MenstrualCycle } = require('../models');
const AppError = require('../utils/appError');

// Orbit — period tracking.
//
// Everything this file produces is an ESTIMATE drawn from what the user
// logged, and it is labelled as one everywhere it is returned. A cycle
// shifts with illness, stress, travel, breastfeeding and plenty else;
// arithmetic over past dates cannot know about any of that.
//
// The fertile-window columns on menstrual_cycles are deliberately left
// unused. The moment an app shows a fertile window, some users will
// treat it as birth control, and calendar prediction is not reliable
// enough to carry that weight — the person who gets it wrong is the one
// who bears the consequence. If it is ever added it needs its own
// decision, not a quiet default.

// How many recent gaps feed the average. Older cycles say less about
// the next one than recent ones do.
const PREDICTION_WINDOW = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

// cycleStartDate is a DATEONLY, so Sequelize hands back 'YYYY-MM-DD'.
// Parse as UTC so that arithmetic never drifts by a day depending on
// where the server happens to be running.
function toUtc(dateOnly) {
  const [year, month, day] = String(dateOnly).slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function toDateOnly(utcMs) {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

// Spread of recent cycle lengths, in plain terms. This describes the
// logged data and nothing more — it is not a finding about the person,
// and must never be presented as one.
function describeRegularity(spread) {
  if (spread <= 3) return 'REGULAR';
  if (spread <= 7) return 'SOMEWHAT_IRREGULAR';
  return 'IRREGULAR';
}

async function listCycles(familyMemberId) {
  return MenstrualCycle.findAll({
    where: { familyMemberId },
    order: [['cycleStartDate', 'DESC']],
  });
}

function computeInsights(cycles) {
  // Oldest first, so consecutive gaps read forwards in time.
  const ordered = [...cycles].sort((a, b) => toUtc(a.cycleStartDate) - toUtc(b.cycleStartDate));

  const base = {
    cyclesLogged: ordered.length,
    lastCycleStart: ordered.length ? ordered[ordered.length - 1].cycleStartDate : null,
    averageCycleLength: null,
    averagePeriodLength: null,
    regularity: 'UNKNOWN',
    prediction: null,
    isEstimate: true,
    notes: [],
  };

  // How long bleeding lasted, for the entries where an end date was
  // recorded. Independent of the gap between cycles.
  const periodLengths = ordered
    .filter((cycle) => cycle.cycleEndDate)
    .map((cycle) => daysBetween(cycle.cycleStartDate, cycle.cycleEndDate) + 1)
    .filter((length) => length > 0);

  if (periodLengths.length > 0) {
    base.averagePeriodLength = Math.round(mean(periodLengths) * 10) / 10;
  }

  if (ordered.length < 2) {
    base.notes.push(
      ordered.length === 0
        ? 'Hakuna kumbukumbu bado. Weka tarehe ya hedhi yako ili Orbit ianze kujifunza mzunguko wako.'
        : 'Mzunguko mmoja tu umeandikwa. Orbit inahitaji angalau miwili kabla ya kukadiria ujao.'
    );
    return base;
  }

  const gaps = [];
  for (let i = 1; i < ordered.length; i += 1) {
    gaps.push(daysBetween(ordered[i - 1].cycleStartDate, ordered[i].cycleStartDate));
  }

  const recent = gaps.slice(-PREDICTION_WINDOW);
  const averageGap = mean(recent);
  const spread = standardDeviation(recent);

  base.averageCycleLength = Math.round(averageGap * 10) / 10;
  base.regularity = describeRegularity(spread);

  const lastStart = ordered[ordered.length - 1].cycleStartDate;
  const nextStart = toDateOnly(toUtc(lastStart) + Math.round(averageGap) * DAY_MS);
  const daysUntil = daysBetween(toDateOnly(Date.now()), nextStart);

  // Confidence follows how much history there is and how tightly it
  // clusters. It never reaches "certain", because it cannot.
  //
  // Note that n logged cycles give only n-1 intervals, so three logged
  // cycles is two observations. A cycle can land on the same number
  // twice by chance, which is why HIGH needs three intervals rather
  // than two however tightly those two agree.
  let confidence = 'LOW';
  if (recent.length >= 3 && spread <= 3) confidence = 'HIGH';
  else if (recent.length >= 2 && spread <= 7) confidence = 'MEDIUM';

  base.prediction = {
    nextStart,
    daysUntil,
    confidence,
    // Intervals between cycles, not cycles — one fewer than the number
    // logged, and naming it plainly avoids that being read wrong.
    basedOnIntervals: recent.length,
  };

  base.notes.push('Hii ni makadirio kutokana na ulichoandika, si uhakika wa kitabibu.');

  if (base.regularity === 'IRREGULAR') {
    // A description of the logged data, and an invitation to talk to a
    // person. Not a diagnosis, and it names no condition.
    base.notes.push(
      'Mizunguko yako iliyoandikwa inatofautiana sana kwa urefu, kwa hiyo makadirio haya ni ya kubahatisha zaidi. Ukipenda kuzungumza na muuguzi kuhusu hilo, Afya Nyumbani ipo.'
    );
  }

  return base;
}

// The stored predictedNextStart is a convenience for anything that
// needs to look it up without recomputing — reminders, later on. It is
// refreshed after every write so it can never describe a history that
// has since changed.
async function refreshStoredPrediction(familyMemberId) {
  const cycles = await listCycles(familyMemberId);
  if (cycles.length === 0) return;

  const insights = computeInsights(cycles);
  const latest = cycles[0]; // listCycles returns newest first

  latest.predictedNextStart = insights.prediction ? insights.prediction.nextStart : null;
  await latest.save();
}

async function create(familyMemberId, payload) {
  const clash = await MenstrualCycle.findOne({
    where: { familyMemberId, cycleStartDate: payload.cycleStartDate },
  });
  if (clash) {
    throw AppError.conflict('A cycle starting on that date is already recorded');
  }

  if (payload.cycleEndDate && daysBetween(payload.cycleStartDate, payload.cycleEndDate) < 0) {
    throw AppError.badRequest('The end date cannot be before the start date');
  }

  const cycle = await MenstrualCycle.create({ familyMemberId, ...payload });
  await refreshStoredPrediction(familyMemberId);
  return cycle.reload();
}

async function list(familyMemberId) {
  return listCycles(familyMemberId);
}

async function getOne(familyMemberId, cycleId) {
  const cycle = await MenstrualCycle.findOne({ where: { id: cycleId, familyMemberId } });
  if (!cycle) throw AppError.notFound('Cycle entry not found');
  return cycle;
}

async function update(familyMemberId, cycleId, payload) {
  const cycle = await getOne(familyMemberId, cycleId);

  const start = payload.cycleStartDate || cycle.cycleStartDate;
  const end = payload.cycleEndDate !== undefined ? payload.cycleEndDate : cycle.cycleEndDate;
  if (end && daysBetween(start, end) < 0) {
    throw AppError.badRequest('The end date cannot be before the start date');
  }

  await cycle.update(payload);
  await refreshStoredPrediction(familyMemberId);
  return cycle.reload();
}

async function remove(familyMemberId, cycleId) {
  const cycle = await getOne(familyMemberId, cycleId);
  await cycle.destroy();
  await refreshStoredPrediction(familyMemberId);
}

async function insights(familyMemberId) {
  const cycles = await listCycles(familyMemberId);
  return computeInsights(cycles);
}

module.exports = { create, list, getOne, update, remove, insights, computeInsights };
