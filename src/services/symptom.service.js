'use strict';

const { Op } = require('sequelize');
const { Symptom } = require('../models');
const AppError = require('../utils/appError');
const catalogService = require('./symptomCatalog.service');
const { evaluateRedFlags } = require('./symptomRules.service');

// Enriches a symptom with catalogue metadata (category/triggers/related
// symptoms) when its name matches a known entry, and always attaches a
// red-flag verdict — this is the "structured data for Afya AI" shape.
async function enrich(symptom) {
  const catalogItem = await catalogService.findByName(symptom.name);
  const redFlag = await evaluateRedFlags(symptom, catalogItem);
  return {
    ...symptom.toJSON(),
    catalog: catalogItem
      ? {
          category: catalogItem.category,
          commonTriggers: catalogItem.commonTriggers,
          relatedSymptoms: catalogItem.relatedSymptoms,
        }
      : null,
    redFlag,
  };
}

async function create(familyMemberId, data) {
  const symptom = await Symptom.create({
    familyMemberId,
    name: data.name,
    severity: data.severity || 'MILD',
    durationValue: data.durationValue ?? null,
    durationUnit: data.durationUnit ?? null,
    frequency: data.frequency || 'ONE_TIME',
    triggers: data.triggers || [],
    notes: data.notes || null,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
  });
  return enrich(symptom);
}

async function list(familyMemberId, { name, severity, since, limit = 50 } = {}) {
  const where = { familyMemberId };
  if (name) where.name = { [Op.iLike]: `%${name}%` };
  if (severity) where.severity = severity;
  if (since) where.occurredAt = { [Op.gte]: new Date(since) };

  return Symptom.findAll({
    where,
    order: [['occurredAt', 'DESC']],
    limit: Math.min(parseInt(limit, 10) || 50, 200),
  });
}

async function getOne(familyMemberId, id) {
  const symptom = await Symptom.findOne({ where: { id, familyMemberId } });
  if (!symptom) throw AppError.notFound('Symptom not found');
  return enrich(symptom);
}

async function update(familyMemberId, id, data) {
  const symptom = await Symptom.findOne({ where: { id, familyMemberId } });
  if (!symptom) throw AppError.notFound('Symptom not found');

  const fields = ['name', 'severity', 'durationValue', 'durationUnit', 'frequency', 'triggers', 'notes'];
  fields.forEach((field) => {
    if (data[field] !== undefined) symptom[field] = data[field];
  });
  if (data.occurredAt !== undefined) symptom.occurredAt = new Date(data.occurredAt);
  await symptom.save();
  return enrich(symptom);
}

async function remove(familyMemberId, id) {
  const symptom = await Symptom.findOne({ where: { id, familyMemberId } });
  if (!symptom) throw AppError.notFound('Symptom not found');
  await symptom.destroy();
}

module.exports = { create, list, getOne, update, remove };
