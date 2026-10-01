'use strict';

const { AppSetting } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

// Operational rules for Care Mobility, changeable by an admin without a
// deploy.
//
// Only keys listed here exist. The table is not a general key-value
// store: an unknown key is refused, and every value is checked against
// its own rule before it is written. The defaults below are what the
// system does when nobody has set anything.
const DEFINITIONS = {
  // How long a home visit is assumed to occupy a nurse, for the
  // double-booking check. A nurse with a 10:00 visit cannot be given
  // another at 11:00 when this is 90 and the buffer below is 30.
  'dispatch.visitDurationMinutes': { default: 90, min: 15, max: 480 },
  // Travel and slack between two visits for the same person.
  'dispatch.travelBufferMinutes': { default: 30, min: 0, max: 240 },
  // How soon a request may be for. Less than this and nobody can
  // realistically be dispatched, so the request is refused with that
  // reason instead of accepted and then missed.
  'booking.minLeadMinutes': { default: 60, min: 0, max: 7 * 24 * 60 },
  // How far ahead a request may be for.
  'booking.maxAdvanceDays': { default: 60, min: 1, max: 365 },
  // A request nobody has dispatched this long after its time has
  // passed becomes EXPIRED, so it stops sitting in the queue looking
  // actionable and the client is told plainly.
  'dispatch.expireAfterMinutes': { default: 60, min: 0, max: 7 * 24 * 60 },
  // Whether transport requests are taken at all, over and above the
  // per-zone flag.
  'transport.enabled': { default: true, type: 'boolean' },
  'transport.maxPassengers': { default: 3, min: 1, max: 8 },
};

function validateValue(key, value) {
  const def = DEFINITIONS[key];
  if (!def) throw AppError.badRequest(`Unknown setting: ${key}`);

  if (def.type === 'boolean') {
    if (typeof value !== 'boolean') throw AppError.badRequest(`${key} must be true or false`);
    return value;
  }

  if (!Number.isInteger(value) || value < def.min || value > def.max) {
    throw AppError.badRequest(`${key} must be a whole number from ${def.min} to ${def.max}`);
  }
  return value;
}

async function getAll() {
  const rows = await AppSetting.findAll();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return Object.fromEntries(
    Object.entries(DEFINITIONS).map(([key, def]) => [
      key,
      {
        value: key in stored ? stored[key] : def.default,
        default: def.default,
        ...(def.type === 'boolean' ? { type: 'boolean' } : { type: 'integer', min: def.min, max: def.max }),
      },
    ])
  );
}

async function get(key) {
  const def = DEFINITIONS[key];
  if (!def) throw new Error(`Unknown setting: ${key}`);
  const row = await AppSetting.findByPk(key);
  return row ? row.value : def.default;
}

async function update(changes, actorUser, req) {
  const entries = Object.entries(changes || {});
  if (entries.length === 0) throw AppError.badRequest('Nothing to change');

  // Check everything before writing anything, so one bad value does
  // not leave half a change behind.
  const checked = entries.map(([key, value]) => [key, validateValue(key, value)]);

  for (const [key, value] of checked) {
    await AppSetting.upsert({ key, value, updatedBy: actorUser.id });
  }

  await logAudit({
    userId: actorUser.id,
    action: 'SETTINGS_UPDATED',
    entityType: 'AppSetting',
    req,
    metadata: { changes: Object.fromEntries(checked) },
  });

  return getAll();
}

module.exports = { DEFINITIONS, getAll, get, update };
