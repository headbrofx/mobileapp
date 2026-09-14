'use strict';

const { HealthMeasurement, Symptom, Visit, Booking } = require('../models');

const MEASUREMENT_LABELS = {
  BLOOD_PRESSURE: 'Blood pressure recorded',
  BLOOD_GLUCOSE: 'Blood glucose recorded',
  HEART_RATE: 'Heart rate recorded',
  TEMPERATURE: 'Temperature recorded',
  OXYGEN_SATURATION: 'Oxygen saturation recorded',
  WEIGHT: 'Weight recorded',
  HEIGHT: 'Height recorded',
  BMI: 'BMI recorded',
};

function measurementSummary(m) {
  if (m.type === 'BLOOD_PRESSURE') return `${m.systolic}/${m.diastolic} mmHg`;
  return `${m.value ?? ''} ${m.unit || ''}`.trim();
}

// Auto-generated timeline: merges vitals, symptoms, and completed visits
// into one chronological feed. No separate "timeline" table — it's
// computed on read from the tables that already exist.
async function buildTimeline(familyMemberId, { limit = 50 } = {}) {
  const cappedLimit = Math.min(parseInt(limit, 10) || 50, 200);

  const [measurements, symptoms, visits] = await Promise.all([
    HealthMeasurement.findAll({ where: { familyMemberId }, order: [['recordedAt', 'DESC']], limit: cappedLimit }),
    Symptom.findAll({ where: { familyMemberId }, order: [['occurredAt', 'DESC']], limit: cappedLimit }),
    Visit.findAll({
      include: [{ model: Booking, as: 'booking', where: { familyMemberId }, attributes: [] }],
      where: { checkOutAt: { [require('sequelize').Op.ne]: null } },
      order: [['checkOutAt', 'DESC']],
      limit: cappedLimit,
    }),
  ]);

  const events = [
    ...measurements.map((m) => ({
      type: 'MEASUREMENT',
      subtype: m.type,
      summary: `${MEASUREMENT_LABELS[m.type] || 'Vital recorded'}: ${measurementSummary(m)}`,
      timestamp: m.recordedAt,
      id: m.id,
    })),
    ...symptoms.map((s) => ({
      type: 'SYMPTOM',
      subtype: s.severity,
      summary: `Symptom added: ${s.name} (${s.severity.toLowerCase()})`,
      timestamp: s.occurredAt,
      id: s.id,
    })),
    ...visits.map((v) => ({
      type: 'VISIT',
      subtype: 'COMPLETED',
      summary: 'Nurse visit completed' + (v.recommendations ? ` — ${v.recommendations}` : ''),
      timestamp: v.checkOutAt,
      id: v.id,
    })),
  ];

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return events.slice(0, cappedLimit);
}

module.exports = { buildTimeline };
