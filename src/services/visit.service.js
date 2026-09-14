'use strict';

const { Visit, Booking, HealthMeasurement, Staff } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { assertTransition } = require('./bookingStateMachine.service');

const DETAIL_INCLUDE = [{ model: Staff, as: 'staff' }];

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

module.exports = { getByBooking, checkIn, update, checkOut };
