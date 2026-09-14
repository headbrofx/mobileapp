'use strict';

const { HealthMeasurement } = require('../models');
const AppError = require('../utils/appError');

async function create(familyMemberId, recordedByUserId, data) {
  return HealthMeasurement.create({
    familyMemberId,
    recordedByUserId,
    type: data.type,
    value: data.value ?? null,
    systolic: data.systolic ?? null,
    diastolic: data.diastolic ?? null,
    unit: data.unit || null,
    notes: data.notes || null,
    recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
  });
}

async function list(familyMemberId, { type, limit = 50 } = {}) {
  return HealthMeasurement.findAll({
    where: { familyMemberId, ...(type ? { type } : {}) },
    order: [['recordedAt', 'DESC']],
    limit: Math.min(parseInt(limit, 10) || 50, 200),
  });
}

async function getOne(familyMemberId, id) {
  const measurement = await HealthMeasurement.findOne({ where: { id, familyMemberId } });
  if (!measurement) throw AppError.notFound('Measurement not found');
  return measurement;
}

async function update(familyMemberId, id, data) {
  const measurement = await getOne(familyMemberId, id);
  const fields = ['value', 'systolic', 'diastolic', 'unit', 'notes'];
  fields.forEach((field) => {
    if (data[field] !== undefined) measurement[field] = data[field];
  });
  if (data.recordedAt !== undefined) measurement.recordedAt = new Date(data.recordedAt);
  await measurement.save();
  return measurement;
}

async function remove(familyMemberId, id) {
  const measurement = await getOne(familyMemberId, id);
  await measurement.destroy();
}

module.exports = { create, list, getOne, update, remove };
