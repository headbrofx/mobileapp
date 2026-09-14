'use strict';

const { Op } = require('sequelize');
const { Symptom } = require('../models');

const SEVERITY_RANK = { MILD: 1, MODERATE: 2, SEVERE: 3 };
const DURATION_UNIT_TO_DAYS = { HOURS: 1 / 24, DAYS: 1, WEEKS: 7 };

function durationInDays(symptom) {
  if (symptom.durationValue == null || !symptom.durationUnit) return null;
  return symptom.durationValue * DURATION_UNIT_TO_DAYS[symptom.durationUnit];
}

// Red-flag rule engine. Combines: (1) catalogue metadata for this
// symptom name, (2) how it was reported (severity/duration), and (3)
// whether other concerning symptoms were reported around the same time
// for the same patient. Always a *signal to review*, never a diagnosis.
async function evaluateRedFlags(symptom, catalogItem) {
  const reasons = [];

  if (catalogItem?.alwaysRedFlag) {
    reasons.push(`${symptom.name} is always treated as needing prompt attention`);
  }

  if (symptom.severity === 'SEVERE') {
    reasons.push('Reported as severe');
  }

  if (catalogItem?.redFlagSeverity && SEVERITY_RANK[symptom.severity] >= SEVERITY_RANK[catalogItem.redFlagSeverity]) {
    reasons.push(`Severity at or above the usual threshold for ${symptom.name}`);
  }

  const days = durationInDays(symptom);
  if (catalogItem?.redFlagDurationDays && days != null && days >= catalogItem.redFlagDurationDays) {
    reasons.push(`Has lasted ${catalogItem.redFlagDurationDays}+ days, longer than expected for ${symptom.name}`);
  }

  // Combination rule: another concerning symptom logged for the same
  // patient within the last 24 hours.
  const recentOther = await Symptom.findOne({
    where: {
      familyMemberId: symptom.familyMemberId,
      id: { [Op.ne]: symptom.id },
      occurredAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      severity: { [Op.in]: ['MODERATE', 'SEVERE'] },
    },
  });
  if (recentOther) {
    reasons.push(`Reported alongside another symptom (${recentOther.name}) within 24 hours`);
  }

  return {
    isRedFlag: reasons.length > 0,
    reasons,
    recommendation: reasons.length > 0 ? 'Seek professional medical attention' : 'Continue monitoring',
  };
}

module.exports = { evaluateRedFlags };
