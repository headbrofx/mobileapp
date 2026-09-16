'use strict';

const { Op } = require('sequelize');
const { Medication, MedicationDose } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

// Medicines and dose reminders.
//
// This module records and schedules. It does not advise. It never
// changes a dose, never suggests starting or stopping a medicine, never
// warns about interactions, and never tells anyone they have taken too
// much or too little. Those are clinical judgements, they need a
// person's whole picture, and getting one wrong here would be worse
// than the app not existing.
//
// Adherence is counted and shown, to the patient and to staff who have
// a booking with them. It is a record a nurse can act on, not a scold.
//
// There is no SMS or push delivery here, because there is no budget for
// a gateway. The API says what is due; the client app schedules its own
// local notifications from that.

// Tanzania keeps UTC+3 all year with no daylight saving, so a
// wall-clock time converts to an instant with no ambiguity.
const TZ_OFFSET_HOURS = 3;

// How far ahead doses are generated. Long enough that a phone offline
// for a week still knows what is coming, short enough that a stopped
// medicine leaves little to clean up.
const HORIZON_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(dateOnly) {
  const [y, m, d] = String(dateOnly).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// "08:00" on a given day, as the instant it happens in Dar es Salaam.
function scheduledInstant(dateOnlyMs, hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(dateOnlyMs + (hours - TZ_OFFSET_HOURS) * 60 * 60 * 1000 + minutes * 60 * 1000);
}

// Fill in the doses this medicine implies, from today (or its start
// date, whichever is later) out to the horizon. Safe to call repeatedly:
// a unique constraint on (medication_id, scheduled_for) means a slot
// that already exists is left exactly as the patient left it, so
// regenerating never overwrites a dose already marked taken.
async function generateDoses(medication) {
  if (medication.status !== 'ACTIVE') return 0;
  if (!medication.scheduleTimes || medication.scheduleTimes.length === 0) return 0;

  const todayMs = parseDateOnly(isoDay(Date.now()));
  const startMs = Math.max(parseDateOnly(medication.startDate), todayMs);
  const horizonMs = todayMs + HORIZON_DAYS * DAY_MS;
  const endMs = medication.endDate
    ? Math.min(parseDateOnly(medication.endDate), horizonMs)
    : horizonMs;

  const rows = [];
  for (let dayMs = startMs; dayMs <= endMs; dayMs += DAY_MS) {
    for (const hhmm of medication.scheduleTimes) {
      const at = scheduledInstant(dayMs, hhmm);
      // Skip slots already in the past at generation time — a reminder
      // for this morning created this afternoon helps nobody, and it
      // would count against adherence for a dose never announced.
      if (at.getTime() < Date.now()) continue;
      rows.push({
        medicationId: medication.id,
        familyMemberId: medication.familyMemberId,
        scheduledFor: at,
        status: 'PENDING',
      });
    }
  }

  if (rows.length === 0) return 0;
  await MedicationDose.bulkCreate(rows, { ignoreDuplicates: true });
  return rows.length;
}

async function create(familyMemberId, payload, { userId = null, req = null } = {}) {
  if (payload.endDate && parseDateOnly(payload.endDate) < parseDateOnly(payload.startDate)) {
    throw AppError.badRequest('The end date cannot be before the start date');
  }

  const medication = await Medication.create({
    familyMemberId,
    ...payload,
    createdBy: userId,
  });

  await generateDoses(medication);

  await logAudit({
    userId,
    action: 'MEDICATION_ADDED',
    entityType: 'Medication',
    entityId: medication.id,
    req,
    metadata: { familyMemberId, name: medication.name },
  });

  return medication;
}

async function list(familyMemberId, { status = null } = {}) {
  const where = { familyMemberId };
  if (status) where.status = status;
  return Medication.findAll({ where, order: [['status', 'ASC'], ['createdAt', 'DESC']] });
}

async function getOne(familyMemberId, medicationId) {
  const medication = await Medication.findOne({ where: { id: medicationId, familyMemberId } });
  if (!medication) throw AppError.notFound('Medication not found');
  return medication;
}

async function update(familyMemberId, medicationId, payload, { userId = null, req = null } = {}) {
  const medication = await getOne(familyMemberId, medicationId);
  const wasActive = medication.status === 'ACTIVE';

  await medication.update(payload);

  // Stopping or completing a course clears what has not happened yet.
  // Doses already answered stay, because they are history.
  if (wasActive && medication.status !== 'ACTIVE') {
    await MedicationDose.destroy({
      where: {
        medicationId: medication.id,
        status: 'PENDING',
        scheduledFor: { [Op.gt]: new Date() },
      },
    });
    await logAudit({
      userId,
      action: 'MEDICATION_STOPPED',
      entityType: 'Medication',
      entityId: medication.id,
      req,
      metadata: { status: medication.status },
    });
  } else if (medication.status === 'ACTIVE') {
    await generateDoses(medication);
  }

  return medication.reload();
}

// --- Doses ---

async function listDoses(familyMemberId, { from = null, to = null, status = null, limit = 200 } = {}) {
  const where = { familyMemberId };

  if (from || to) {
    where.scheduledFor = {};
    if (from) where.scheduledFor[Op.gte] = new Date(from);
    if (to) where.scheduledFor[Op.lte] = new Date(to);
  }
  if (status) where.status = status;

  return MedicationDose.findAll({
    where,
    include: [{ model: Medication, as: 'medication', attributes: ['id', 'name', 'dosage', 'form', 'instructions'] }],
    order: [['scheduledFor', 'ASC']],
    limit,
  });
}

// What the client app turns into local notifications.
async function dueDoses(familyMemberId, { hours = 24 } = {}) {
  return listDoses(familyMemberId, {
    from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    status: 'PENDING',
  });
}

async function markDose(familyMemberId, doseId, { status, note = null }) {
  const dose = await MedicationDose.findOne({ where: { id: doseId, familyMemberId } });
  if (!dose) throw AppError.notFound('Dose not found');

  dose.status = status;
  dose.note = note;
  dose.takenAt = status === 'TAKEN' ? new Date() : null;
  await dose.save();

  return dose;
}

// Sweep slots whose time has passed and which nobody answered. Called
// when adherence is read, so the numbers are honest without needing a
// scheduler running somewhere.
async function closeOutOverdue(familyMemberId, { graceHours = 6 } = {}) {
  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);
  const [count] = await MedicationDose.update(
    { status: 'MISSED' },
    { where: { familyMemberId, status: 'PENDING', scheduledFor: { [Op.lt]: cutoff } } }
  );
  return count;
}

async function adherence(familyMemberId, { days = 7 } = {}) {
  await closeOutOverdue(familyMemberId);

  const since = new Date(Date.now() - days * DAY_MS);

  // A dose counts once it has been answered, even if its slot is still
  // a few hours off — somebody who takes the evening tablet at four in
  // the afternoon has taken it, and the count should say so. A slot
  // nobody has answered only counts once its time has passed, which
  // closeOutOverdue has just marked MISSED.
  const doses = await MedicationDose.findAll({
    where: {
      familyMemberId,
      scheduledFor: { [Op.gte]: since },
      [Op.or]: [
        { status: { [Op.ne]: 'PENDING' } },
        { scheduledFor: { [Op.lte]: new Date() } },
      ],
    },
    include: [{ model: Medication, as: 'medication', attributes: ['id', 'name'] }],
  });

  const answered = doses.filter((dose) => dose.status !== 'PENDING');
  const taken = answered.filter((dose) => dose.status === 'TAKEN').length;
  const missed = answered.filter((dose) => dose.status === 'MISSED').length;
  const skipped = answered.filter((dose) => dose.status === 'SKIPPED').length;

  // Per medicine, because "80% overall" hides one medicine being missed
  // every time while the others are taken.
  const byMedication = {};
  for (const dose of answered) {
    const key = dose.medication ? dose.medication.name : dose.medicationId;
    byMedication[key] = byMedication[key] || { taken: 0, missed: 0, skipped: 0 };
    byMedication[key][dose.status.toLowerCase()] += 1;
  }

  return {
    periodDays: days,
    dosesScheduled: doses.length,
    dosesAnswered: answered.length,
    taken,
    missed,
    skipped,
    // Null rather than 0% when nothing has come due yet, which is not
    // the same as having missed everything.
    takenPercent: answered.length ? Math.round((taken / answered.length) * 100) : null,
    byMedication,
  };
}

module.exports = {
  create,
  list,
  getOne,
  update,
  generateDoses,
  listDoses,
  dueDoses,
  markDose,
  closeOutOverdue,
  adherence,
  HORIZON_DAYS,
};
