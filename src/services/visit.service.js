'use strict';

const { Op } = require('sequelize');
const { Visit, Booking, HealthMeasurement, Staff, User, FamilyMember, Service } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { assertTransition } = require('./bookingStateMachine.service');

// The nurse as far as anyone reading a visit needs to know: who, and
// what they are. This used to include the whole staff row, which since
// Care Mobility carries where they start work from (baseLat/baseLng) and
// their licence number. A client reading their own visit has no business
// with either.
const DETAIL_INCLUDE = [
  {
    model: Staff,
    as: 'staff',
    attributes: ['id', 'specialty'],
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  },
];

function measurementSummary(v) {
  if (v.type === 'BLOOD_PRESSURE') return `${v.systolic}/${v.diastolic} mmHg`;
  return `${v.value ?? ''} ${v.unit || ''}`.trim();
}

async function getByBooking(bookingId) {
  const visit = await Visit.findOne({ where: { bookingId }, include: DETAIL_INCLUDE });
  if (!visit) throw AppError.notFound('No visit record for this booking yet');
  return visit;
}

// "Check in" is the clinical start of the visit: the assigned staff
// member has arrived and is beginning care. It folds the Phase 5
// ARRIVED -> IN_PROGRESS transition in with creating the Visit record,
// so the nurse only has to tap one thing when they walk in the door.
async function checkIn(bookingId, actorUser, req) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const existing = await Visit.findOne({ where: { bookingId } });
  if (existing) throw AppError.conflict('This booking already has a visit record');

  assertTransition(booking, 'start');
  booking.status = 'IN_PROGRESS';
  await booking.save();

  const visit = await Visit.create({
    bookingId: booking.id,
    staffId: booking.staffId,
    checkInAt: new Date(),
  });

  await logAudit({
    userId: actorUser.id,
    action: 'VISIT_CHECKED_IN',
    req,
    entityType: 'Visit',
    entityId: visit.id,
    metadata: { bookingId: booking.id },
  });

  return getByBooking(booking.id);
}

// Draft update while the visit is open — clinical notes and, optionally,
// real vitals readings. Each vitals entry becomes a genuine
// HealthMeasurement against the patient's own health record (so it shows
// up in their timeline/insights, same as a self-logged reading — see
// Phase 3), attributed to the recording staff member, plus a lightweight
// summary is kept on the Visit itself as vitalsSnapshot.
async function update(bookingId, data, actorUser, req) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const visit = await Visit.findOne({ where: { bookingId } });
  if (!visit) throw AppError.notFound('No visit record for this booking yet — check in first');
  if (visit.checkOutAt) throw AppError.conflict('This visit has already been checked out');

  const fields = ['assessment', 'treatmentNotes', 'recommendations', 'followUpDate', 'attachments'];
  fields.forEach((field) => {
    if (data[field] !== undefined) visit[field] = data[field];
  });

  if (Array.isArray(data.vitals) && data.vitals.length > 0) {
    const created = await Promise.all(
      data.vitals.map((v) =>
        HealthMeasurement.create({
          familyMemberId: booking.familyMemberId,
          recordedByUserId: actorUser.id,
          type: v.type,
          value: v.value ?? null,
          systolic: v.systolic ?? null,
          diastolic: v.diastolic ?? null,
          unit: v.unit || null,
          notes: 'Recorded during home visit',
        })
      )
    );

    const snapshot = Array.isArray(visit.vitalsSnapshot) ? visit.vitalsSnapshot : [];
    visit.vitalsSnapshot = [
      ...snapshot,
      ...created.map((m) => ({
        measurementId: m.id,
        type: m.type,
        summary: measurementSummary(m),
        recordedAt: m.recordedAt,
      })),
    ];
  }

  await visit.save();

  await logAudit({
    userId: actorUser.id,
    action: 'VISIT_UPDATED',
    req,
    entityType: 'Visit',
    entityId: visit.id,
    metadata: { fields: Object.keys(data) },
  });

  return getByBooking(booking.id);
}

// "Check out" closes the clinical record and completes the booking in
// the same action — from the nurse's side, finishing the visit *is*
// completing the booking. Requires an assessment on file (either set
// earlier via PATCH, or provided here) as a minimal clinical
// completeness gate before a visit can be closed out.
async function checkOut(bookingId, data, actorUser, req) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const visit = await Visit.findOne({ where: { bookingId } });
  if (!visit) throw AppError.notFound('No visit record for this booking yet — check in first');
  if (visit.checkOutAt) throw AppError.conflict('This visit has already been checked out');

  if (data.assessment !== undefined) visit.assessment = data.assessment;
  if (!visit.assessment) {
    throw AppError.badRequest('An assessment is required before checking out');
  }

  assertTransition(booking, 'complete');

  visit.checkOutAt = new Date();
  await visit.save();

  booking.status = 'COMPLETED';
  await booking.save();

  await logAudit({
    userId: actorUser.id,
    action: 'VISIT_CHECKED_OUT',
    req,
    entityType: 'Visit',
    entityId: visit.id,
    metadata: { bookingId: booking.id },
  });
  await logAudit({
    userId: actorUser.id,
    action: 'BOOKING_COMPLETED',
    req,
    entityType: 'Booking',
    entityId: booking.id,
  });

  return getByBooking(booking.id);
}

// The whole report for one visit, in one shape: what a client reads,
// what an admin prints. Null when the nurse has not checked in yet.
function toReport(visit, booking) {
  return {
    visitId: visit.id,
    bookingId: booking.id,
    reference: booking.bookingReference,
    service: booking.service ? booking.service.name : null,
    patient: booking.patient
      ? {
          id: booking.patient.id,
          name: booking.patient.name,
          dateOfBirth: booking.patient.dateOfBirth,
          gender: booking.patient.gender,
        }
      : null,
    nurse: visit.staff
      ? { name: visit.staff.user ? visit.staff.user.name : null, specialty: visit.staff.specialty }
      : null,
    place: booking.locationAddress,
    scheduledAt: booking.scheduledAt,
    checkInAt: visit.checkInAt,
    checkOutAt: visit.checkOutAt,
    status: visit.checkOutAt ? 'FINAL' : 'DRAFT',
    assessment: visit.assessment,
    treatmentNotes: visit.treatmentNotes,
    recommendations: visit.recommendations,
    followUpDate: visit.followUpDate,
    vitals: Array.isArray(visit.vitalsSnapshot) ? visit.vitalsSnapshot : [],
    attachments: visit.attachments || [],
    updatedAt: visit.updatedAt,
  };
}

const REPORT_BOOKING_INCLUDE = [
  { model: FamilyMember, as: 'patient', attributes: ['id', 'name', 'dateOfBirth', 'gender'] },
  { model: Service, as: 'service', attributes: ['id', 'name'] },
];

async function reportForBooking(bookingId) {
  const visit = await Visit.findOne({ where: { bookingId }, include: DETAIL_INCLUDE });
  if (!visit) return null;
  const booking = await Booking.findByPk(bookingId, { include: REPORT_BOOKING_INCLUDE });
  return toReport(visit, booking);
}

// Every visit report, newest first, for the office. Searchable by the
// patient's name or the booking reference, and by date.
async function listReports({ q = null, from = null, to = null, limit = 50 } = {}) {
  const where = {};
  if (from || to) {
    where.checkInAt = {};
    if (from) where.checkInAt[Op.gte] = new Date(from);
    if (to) where.checkInAt[Op.lte] = new Date(`${to}T23:59:59.999Z`);
  }

  const bookingWhere = {};
  const patientWhere = {};
  const term = q ? String(q).trim() : '';
  if (term) {
    // A reference looks like AN-XXXXXX; anything else is a name.
    if (/^AN-/i.test(term)) bookingWhere.bookingReference = term.toUpperCase();
    else patientWhere.name = { [Op.iLike]: `%${term.replace(/[%_]/g, '')}%` };
  }

  const visits = await Visit.findAll({
    where,
    include: [
      ...DETAIL_INCLUDE,
      {
        model: Booking,
        as: 'booking',
        where: Object.keys(bookingWhere).length ? bookingWhere : undefined,
        required: true,
        include: [
          {
            ...REPORT_BOOKING_INCLUDE[0],
            where: Object.keys(patientWhere).length ? patientWhere : undefined,
            required: Object.keys(patientWhere).length > 0,
          },
          REPORT_BOOKING_INCLUDE[1],
        ],
      },
    ],
    order: [['checkInAt', 'DESC']],
    limit: Math.min(parseInt(limit, 10) || 50, 200),
  });

  return visits.map((v) => toReport(v, v.booking));
}

module.exports = { getByBooking, checkIn, update, checkOut, reportForBooking, listReports };
