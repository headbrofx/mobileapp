'use strict';

const { Op } = require('sequelize');
const { Symptom } = require('../models');

const WINDOW_DAYS = 30;
const SEVERITY_RANK = { MILD: 1, MODERATE: 2, SEVERE: 3 };

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Compares symptom frequency in the last 30 days against the 30 days
// before that, per symptom name — the "symptom trends" requirement.
async function computeSymptomTrends(familyMemberId) {
  const windowStart = daysAgo(WINDOW_DAYS);
  const previousWindowStart = daysAgo(WINDOW_DAYS * 2);

  const symptoms = await Symptom.findAll({
    where: { familyMemberId, occurredAt: { [Op.gte]: previousWindowStart } },
    order: [['occurredAt', 'DESC']],
  });

  const byName = new Map();
  for (const s of symptoms) {
    const key = s.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { name: s.name, currentCount: 0, previousCount: 0, mostSevere: 'MILD', lastOccurredAt: s.occurredAt });
    }
    const entry = byName.get(key);

    if (s.occurredAt >= windowStart) {
      entry.currentCount += 1;
    } else {
      entry.previousCount += 1;
    }
    if (SEVERITY_RANK[s.severity] > SEVERITY_RANK[entry.mostSevere]) {
      entry.mostSevere = s.severity;
    }
    if (s.occurredAt > entry.lastOccurredAt) {
      entry.lastOccurredAt = s.occurredAt;
    }
  }

  return Array.from(byName.values()).map((entry) => ({
    name: entry.name,
    currentWindowCount: entry.currentCount,
    previousWindowCount: entry.previousCount,
    direction:
      entry.currentCount > entry.previousCount
        ? 'INCREASING'
        : entry.currentCount < entry.previousCount
          ? 'DECREASING'
          : 'STABLE',
    mostSevere: entry.mostSevere,
    lastOccurredAt: entry.lastOccurredAt,
  }));
}

module.exports = { computeSymptomTrends };
