'use strict';

const { Op, fn, col } = require('sequelize');
const { HealthMeasurement, Symptom } = require('../models');
const { evaluateMeasurement } = require('../utils/vitalsRanges');

const BASELINE_TYPES = ['BLOOD_PRESSURE', 'BLOOD_GLUCOSE', 'WEIGHT'];
const LOOKBACK_DAYS = 30;

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function trendValue(m) {
  return m.type === 'BLOOD_PRESSURE' ? m.systolic : m.value;
}

async function computeTrends(familyMemberId) {
  const types = await HealthMeasurement.findAll({
    where: { familyMemberId },
    attributes: [[fn('DISTINCT', col('type')), 'type']],
    raw: true,
  });

  const trends = [];
  for (const { type } of types) {
    const recent = await HealthMeasurement.findAll({
      where: { familyMemberId, type },
      order: [['recordedAt', 'DESC']],
      limit: 2,
    });
    if (recent.length < 2) continue;

    const [latest, previous] = recent;
    const latestVal = trendValue(latest);
    const previousVal = trendValue(previous);
    if (latestVal == null || previousVal == null) continue;

    const delta = latestVal - previousVal;
    trends.push({
      type,
      latestValue: latestVal,
      previousValue: previousVal,
      delta,
      direction: delta > 0 ? 'UP' : delta < 0 ? 'DOWN' : 'STABLE',
      latestRecordedAt: latest.recordedAt,
    });
  }
  return trends;
}

async function computeMissingMeasurements(familyMemberId) {
  const since = daysAgo(LOOKBACK_DAYS);
  const missing = [];

  for (const type of BASELINE_TYPES) {
    const last = await HealthMeasurement.findOne({
      where: { familyMemberId, type },
      order: [['recordedAt', 'DESC']],
    });
    if (!last || last.recordedAt < since) {
      missing.push({ type, lastRecordedAt: last ? last.recordedAt : null });
    }
  }
  return missing;
}

async function computeAbnormalReadings(familyMemberId) {
  const since = daysAgo(LOOKBACK_DAYS);
  const recent = await HealthMeasurement.findAll({
    where: { familyMemberId, recordedAt: { [Op.gte]: since } },
    order: [['recordedAt', 'DESC']],
    limit: 100,
  });

  return recent
    .map((m) => {
      const verdict = evaluateMeasurement(m);
      if (!verdict || verdict.status === 'NORMAL') return null;
      return {
        measurementId: m.id,
        type: m.type,
        value: m.type === 'BLOOD_PRESSURE' ? `${m.systolic}/${m.diastolic}` : m.value,
        status: verdict.status,
        label: verdict.label,
        recordedAt: m.recordedAt,
      };
    })
    .filter(Boolean);
}

async function computeRecurringSymptoms(familyMemberId) {
  const since = daysAgo(LOOKBACK_DAYS);
  const symptoms = await Symptom.findAll({
    where: { familyMemberId, occurredAt: { [Op.gte]: since } },
    order: [['occurredAt', 'DESC']],
  });

  const byName = new Map();
  for (const s of symptoms) {
    const key = s.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { name: s.name, count: 0, lastSeverity: s.severity, lastOccurredAt: s.occurredAt });
    }
    byName.get(key).count += 1;
  }

  return Array.from(byName.values()).filter((entry) => entry.count >= 2);
}

// The Phase 3 "insights engine": trends, gaps in tracking, abnormal
// readings (rule-of-thumb, not diagnostic), and recurring symptoms —
// all computed on read from Phase 1's tables, no separate insights table.
async function computeInsights(familyMemberId) {
  const [trends, missingMeasurements, abnormalReadings, recurringSymptoms] = await Promise.all([
    computeTrends(familyMemberId),
    computeMissingMeasurements(familyMemberId),
    computeAbnormalReadings(familyMemberId),
    computeRecurringSymptoms(familyMemberId),
  ]);

  return {
    trends,
    missingMeasurements,
    abnormalReadings,
    recurringSymptoms,
    generatedAt: new Date(),
    disclaimer: 'Automated, rule-of-thumb signals — not a medical diagnosis. See a clinician for anything concerning.',
  };
}

module.exports = { computeInsights };
