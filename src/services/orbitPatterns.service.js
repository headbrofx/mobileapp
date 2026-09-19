'use strict';

const { Op } = require('sequelize');
const { OrbitCheckin, MenstrualCycle } = require('../models');

// What Orbit has noticed, and — more often — what it has not.
//
// This file exists to answer one question honestly: does the data this
// person has entered actually support saying something about their body?
// Most of the code here is the machinery for saying no.
//
// Three states, kept apart everywhere:
//
//   NO_DATA           nothing recorded yet
//   INSUFFICIENT_DATA something recorded, not enough to mean anything
//   OBSERVED          a real count, from real rows, stated as a count
//
// The temptation in a product like this is to always have something to
// say, because a dashboard with a blank card looks unfinished. That
// temptation is exactly what produces "your hormones are unbalanced" out
// of four data points. A person deciding whether to see a nurse deserves
// to know the difference between a pattern and a coincidence, so every
// statement below carries how many days it came from and none of them
// names a condition.
//
// Nothing here diagnoses. The vocabulary is deliberately flat —
// "recorded", "on the days you logged", "worth watching" — because
// Orbit can see what somebody typed and nothing else. It cannot see
// them.

const DAY_MS = 24 * 60 * 60 * 1000;

// Below this many check-ins we say so rather than averaging. Seven is
// not a statistical threshold, it is the smallest window in which a
// person could plausibly recognise their own week.
const MIN_CHECKINS_FOR_TREND = 7;

// A comparison window needs two halves that are each worth comparing.
const MIN_CHECKINS_FOR_COMPARISON = 14;

// Cycle-phase statements need more than one cycle, or "the days before
// your period" means "those four days last month".
const MIN_CYCLES_FOR_PHASE = 2;

// How far back the engine looks. Bodies change; a pattern from a year
// ago is history, not a description of now.
const LOOKBACK_DAYS = 120;

const SCALES = ['mood', 'energy', 'sleep', 'appetite', 'pain'];

function toUtc(dateOnly) {
  const [y, m, d] = String(dateOnly).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toDateOnly(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// --- Reading ----------------------------------------------------------

async function recentCheckins(familyMemberId, days = LOOKBACK_DAYS) {
  const since = toDateOnly(Date.now() - days * DAY_MS);
  return OrbitCheckin.findAll({
    where: { familyMemberId, checkinDate: { [Op.gte]: since } },
    order: [['checkinDate', 'ASC']],
  });
}

async function recentCycles(familyMemberId) {
  return MenstrualCycle.findAll({
    where: { familyMemberId },
    order: [['cycleStartDate', 'ASC']],
  });
}

// --- The three states -------------------------------------------------

function state(count, minimum) {
  if (count === 0) return 'NO_DATA';
  if (count < minimum) return 'INSUFFICIENT_DATA';
  return 'OBSERVED';
}

// --- Scale trends -----------------------------------------------------
//
// "Changing" here means the recent half of the window differs from the
// earlier half by more than half a point on a five-point scale. That
// threshold is a judgement, and it is deliberately blunt: a tenth of a
// point on a scale where people pick whole numbers is noise, and
// reporting it as a change would teach someone to distrust the app the
// first time it happened for no reason.

function trendFor(checkins, field) {
  const values = checkins
    .map((c) => ({ date: c.checkinDate, value: c[field] }))
    .filter((row) => row.value !== null && row.value !== undefined);

  const status = state(values.length, MIN_CHECKINS_FOR_TREND);
  const summary = {
    field,
    status,
    daysRecorded: values.length,
    average: values.length ? round1(mean(values.map((v) => v.value))) : null,
    direction: 'UNKNOWN',
  };

  if (status !== 'OBSERVED' || values.length < MIN_CHECKINS_FOR_COMPARISON) {
    // An average from seven days is worth showing; a trend from seven
    // days is two halves of three, which is not a trend.
    return summary;
  }

  const half = Math.floor(values.length / 2);
  const earlier = mean(values.slice(0, half).map((v) => v.value));
  const later = mean(values.slice(-half).map((v) => v.value));
  const delta = later - earlier;

  summary.earlierAverage = round1(earlier);
  summary.recentAverage = round1(later);
  summary.delta = round1(delta);

  if (Math.abs(delta) < 0.5) summary.direction = 'STEADY';
  else summary.direction = delta > 0 ? 'UP' : 'DOWN';

  return summary;
}

// --- Cycle-phase observations ----------------------------------------
//
// The only phase claim Orbit makes is a count: on the days you recorded
// that were within N days of a recorded period start, this is how often
// you also recorded that symptom. No luteal phase, no oestrogen, no
// mechanism — because the data is a list of days somebody typed, and
// that supports counting and nothing else.

function periodStarts(cycles) {
  return cycles.map((c) => toUtc(c.cycleStartDate));
}

function nearestStartOffset(dayMs, starts) {
  if (starts.length === 0) return null;
  let best = null;
  for (const start of starts) {
    const offset = Math.round((dayMs - start) / DAY_MS);
    if (best === null || Math.abs(offset) < Math.abs(best)) best = offset;
  }
  return best;
}

// Days -3..-1 relative to a recorded period start.
function beforePeriodObservation(checkins, cycles, field, lowIsNotable) {
  const starts = periodStarts(cycles);
  const observation = {
    field,
    window: 'BEFORE_PERIOD',
    status: state(cycles.length, MIN_CYCLES_FOR_PHASE),
    daysInWindow: 0,
    daysOutsideWindow: 0,
    windowAverage: null,
    otherAverage: null,
    notable: false,
  };

  if (observation.status !== 'OBSERVED') return observation;

  const inWindow = [];
  const outside = [];

  for (const checkin of checkins) {
    const value = checkin[field];
    if (value === null || value === undefined) continue;
    const offset = nearestStartOffset(toUtc(checkin.checkinDate), starts);
    if (offset === null) continue;
    if (offset >= -3 && offset <= -1) inWindow.push(value);
    else outside.push(value);
  }

  observation.daysInWindow = inWindow.length;
  observation.daysOutsideWindow = outside.length;

  // Three days inside the window is one cycle's worth. Comparing that
  // to everything else and calling the difference a pattern is how a
  // coincidence becomes a claim.
  if (inWindow.length < 4 || outside.length < 4) {
    observation.status = 'INSUFFICIENT_DATA';
    return observation;
  }

  observation.windowAverage = round1(mean(inWindow));
  observation.otherAverage = round1(mean(outside));

  const delta = observation.windowAverage - observation.otherAverage;
  observation.delta = round1(delta);
  observation.notable = lowIsNotable ? delta <= -0.5 : delta >= 0.5;

  return observation;
}

// Which symptoms were ticked most, and on how many days.
function symptomCounts(checkins) {
  const counts = new Map();
  let daysWithAny = 0;

  for (const checkin of checkins) {
    const list = Array.isArray(checkin.symptoms) ? checkin.symptoms : [];
    if (list.length) daysWithAny += 1;
    for (const symptom of list) {
      counts.set(symptom, (counts.get(symptom) ?? 0) + 1);
    }
  }

  return {
    status: state(checkins.length, MIN_CHECKINS_FOR_TREND),
    daysRecorded: checkins.length,
    daysWithAny,
    top: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, days]) => ({ name, days })),
  };
}

// Flow on the first days of a recorded period, against the rest.
function flowObservation(checkins, cycles) {
  const WEIGHT = { NONE: 0, SPOTTING: 1, LIGHT: 2, MEDIUM: 3, HEAVY: 4 };
  const starts = periodStarts(cycles);

  const observation = {
    window: 'FIRST_DAYS',
    status: state(cycles.length, MIN_CYCLES_FOR_PHASE),
    daysInWindow: 0,
    heavierEarly: false,
  };
  if (observation.status !== 'OBSERVED') return observation;

  const early = [];
  const later = [];
  for (const checkin of checkins) {
    if (!checkin.flow || !(checkin.flow in WEIGHT)) continue;
    const offset = nearestStartOffset(toUtc(checkin.checkinDate), starts);
    if (offset === null || offset < 0) continue;
    if (offset <= 1) early.push(WEIGHT[checkin.flow]);
    else if (offset <= 6) later.push(WEIGHT[checkin.flow]);
  }

  observation.daysInWindow = early.length;
  if (early.length < 3 || later.length < 3) {
    observation.status = 'INSUFFICIENT_DATA';
    return observation;
  }

  observation.earlyAverage = round1(mean(early));
  observation.laterAverage = round1(mean(later));
  observation.heavierEarly = observation.earlyAverage - observation.laterAverage >= 0.5;
  return observation;
}

// --- Wellness snapshot ------------------------------------------------
//
// Deliberately not a score. A number out of a hundred invites somebody
// to feel they are failing at having a body, and there is nothing behind
// it — no scale of wellness exists that a phone can compute from five
// sliders. Three words, each of which means something checkable:
//
//   STABLE     enough days recorded, and the halves agree
//   CHANGING   enough days recorded, and the halves differ
//   MONITORING not enough recorded to say either way
//
// MONITORING is the honest default, not a hedge.

function snapshotFor(trend) {
  if (trend.status !== 'OBSERVED') return 'MONITORING';
  if (trend.direction === 'STEADY') return 'STABLE';
  if (trend.direction === 'UNKNOWN') return 'MONITORING';
  return 'CHANGING';
}

// --- The public shape -------------------------------------------------

async function patterns(familyMemberId) {
  const [checkins, cycles] = await Promise.all([
    recentCheckins(familyMemberId),
    recentCycles(familyMemberId),
  ]);

  const trends = {};
  for (const field of SCALES) trends[field] = trendFor(checkins, field);

  const snapshot = {
    cycle:
      cycles.length === 0
        ? 'MONITORING'
        : cycles.length < MIN_CYCLES_FOR_PHASE
          ? 'MONITORING'
          : 'STABLE',
    energy: snapshotFor(trends.energy),
    mood: snapshotFor(trends.mood),
    sleep: snapshotFor(trends.sleep),
    symptoms: checkins.length >= MIN_CHECKINS_FOR_TREND ? 'STABLE' : 'MONITORING',
  };

  return {
    // Everything a caller needs to decide whether to show anything at
    // all, rather than having to infer it from empty arrays.
    daysRecorded: checkins.length,
    cyclesRecorded: cycles.length,
    lookbackDays: LOOKBACK_DAYS,
    thresholds: {
      trend: MIN_CHECKINS_FOR_TREND,
      comparison: MIN_CHECKINS_FOR_COMPARISON,
      cycles: MIN_CYCLES_FOR_PHASE,
    },
    trends,
    symptoms: symptomCounts(checkins),
    beforePeriod: {
      energy: beforePeriodObservation(checkins, cycles, 'energy', true),
      mood: beforePeriodObservation(checkins, cycles, 'mood', true),
      pain: beforePeriodObservation(checkins, cycles, 'pain', false),
    },
    flow: flowObservation(checkins, cycles),
    snapshot,
  };
}

// --- Today's insight --------------------------------------------------
//
// One observation, or none. The rule is that an insight has to be
// something the person could verify by looking at their own entries —
// if Orbit cannot point at the days it came from, it does not say it.

async function todayInsight(familyMemberId) {
  const data = await patterns(familyMemberId);

  if (data.daysRecorded === 0) {
    return { status: 'NO_DATA', insight: null, daysRecorded: 0 };
  }

  if (data.daysRecorded < MIN_CHECKINS_FOR_COMPARISON) {
    return {
      status: 'INSUFFICIENT_DATA',
      insight: null,
      daysRecorded: data.daysRecorded,
      daysNeeded: MIN_CHECKINS_FOR_COMPARISON,
    };
  }

  // Energy and mood first because they are the two people notice, then
  // sleep. Pain is reported through the symptom list rather than here,
  // where a "your pain is up" card would read as a warning.
  const order = ['energy', 'mood', 'sleep'];
  for (const field of order) {
    const trend = data.trends[field];
    if (trend.status === 'OBSERVED' && (trend.direction === 'UP' || trend.direction === 'DOWN')) {
      return {
        status: 'OBSERVED',
        daysRecorded: data.daysRecorded,
        insight: {
          field,
          direction: trend.direction,
          recentAverage: trend.recentAverage,
          earlierAverage: trend.earlierAverage,
          daysCompared: trend.daysRecorded,
        },
      };
    }
  }

  return {
    status: 'STEADY',
    daysRecorded: data.daysRecorded,
    insight: null,
  };
}

// --- Monthly report ---------------------------------------------------

async function monthlyReport(familyMemberId, { year, month } = {}) {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;

  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const to = toDateOnly(Date.UTC(y, m, 0));

  const [checkins, cycles] = await Promise.all([
    OrbitCheckin.findAll({
      where: { familyMemberId, checkinDate: { [Op.between]: [from, to] } },
      order: [['checkinDate', 'ASC']],
    }),
    MenstrualCycle.findAll({
      where: { familyMemberId, cycleStartDate: { [Op.between]: [from, to] } },
      order: [['cycleStartDate', 'ASC']],
    }),
  ]);

  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const averages = {};
  for (const field of SCALES) {
    const values = checkins.map((c) => c[field]).filter((v) => v !== null && v !== undefined);
    averages[field] = values.length
      ? { average: round1(mean(values)), daysRecorded: values.length }
      : { average: null, daysRecorded: 0 };
  }

  const periodDays = cycles
    .filter((c) => c.cycleEndDate)
    .map((c) => Math.round((toUtc(c.cycleEndDate) - toUtc(c.cycleStartDate)) / DAY_MS) + 1)
    .filter((d) => d > 0);

  return {
    period: { year: y, month: m, from, to },
    // Check-in consistency, stated as the fraction it is. A month with
    // four entries should not read the same as a month with thirty.
    consistency: {
      daysRecorded: checkins.length,
      daysInMonth,
      // Only meaningful for a month that has finished or is underway;
      // the caller decides how to phrase it.
      percent: Math.round((checkins.length / daysInMonth) * 100),
    },
    averages,
    periodsRecorded: cycles.length,
    averagePeriodLength: periodDays.length ? round1(mean(periodDays)) : null,
    symptoms: symptomCounts(checkins),
    status: checkins.length === 0 ? 'NO_DATA' : 'OBSERVED',
  };
}

module.exports = {
  patterns,
  todayInsight,
  monthlyReport,
  // Exported for the tests, which check the refusals rather than only
  // the happy path.
  trendFor,
  beforePeriodObservation,
  MIN_CHECKINS_FOR_TREND,
  MIN_CHECKINS_FOR_COMPARISON,
  MIN_CYCLES_FOR_PHASE,
};
