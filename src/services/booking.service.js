'use strict';

const { Op } = require('sequelize');
const { Booking, ClientProfile, Staff, FamilyMember, Service } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { assertTransition } = require('./bookingStateMachine.service');
const { suggestStaffForBooking } = require('./staffMatch.service');
const { DETAIL_INCLUDE } = require('../middleware/bookingAccess');

async function findDetailed(id) {
  const booking = await Booking.findByPk(id, { include: DETAIL_INCLUDE });
  if (!booking) throw AppError.notFound('Booking not found');
  return booking;
}

// familyMemberId comes from the request body (not the URL), so ownership
// can't be checked by the loadOwnedFamilyMember middleware — verified here
// instead, against the requesting client's own ClientProfile.
async function create(user, data) {
  const clientProfile = await ClientProfile.findOne({ where: { userId: user.id } });
  if (!clientProfile) throw AppError.badRequest('No client profile for this account');

  const familyMember = await FamilyMember.findOne({
    where: { id: data.familyMemberId, clientProfileId: clientProfile.id },
  });
  if (!familyMember) throw AppError.notFound('Family member not found');

  const service = await Service.findOne({ where: { id: data.serviceId, isActive: true } });
  if (!service) throw AppError.notFound('Service not found');

  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
    throw AppError.badRequest('scheduledAt must be a valid time in the future');
  }

  const booking = await Booking.create({
    clientProfileId: clientProfile.id,
    familyMemberId: familyMember.id,
    serviceId: service.id,
    status: 'REQUESTED',
    locationAddress: data.locationAddress,
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
    scheduledAt,
    notes: data.notes || null,
  });

  await logAudit({
    userId: user.id,
    action: 'BOOKING_CREATED',
    entityType: 'Booking',
    entityId: booking.id,
    metadata: { serviceId: service.id, familyMemberId: familyMember.id },
  });

  return findDetailed(booking.id);
}

async function list(user, query = {}) {
  const where = {};
  if (query.status) where.status = query.status;

  if (user.role === 'CLIENT') {
    const clientProfile = await ClientProfile.findOne({ where: { userId: user.id } });
    where.clientProfileId = clientProfile ? clientProfile.id : '00000000-0000-0000-0000-000000000000';
  } else if (user.role === 'STAFF') {
    const staff = await Staff.findOne({ where: { userId: user.id } });
    where.staffId = staff ? staff.id : '00000000-0000-0000-0000-000000000000';
  }
  // ADMIN: no extra filter — sees every booking.

  return Booking.findAll({
    where,
    include: DETAIL_INCLUDE,
    order: [['scheduledAt', 'DESC']],
    limit: Math.min(parseInt(query.limit, 10) || 50, 200),
  });
}

async function getOne(id) {
  return findDetailed(id);
}

const OPEN_STATUSES = ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];

// "My day" view for a staff member: their assigned bookings, soonest
// first, defaulting to the still-open ones unless a specific ?status= is
// requested (so a completed/cancelled visit doesn't clutter the list they
// check before heading out).
async function mySchedule(user, query = {}) {
  const staff = await Staff.findOne({ where: { userId: user.id } });
  if (!staff) throw AppError.notFound('Staff profile not found');

  const where = { staffId: staff.id };
  where.status = query.status ? query.status : { [Op.in]: OPEN_STATUSES };

  return Booking.findAll({
    where,
    include: DETAIL_INCLUDE,
    order: [['scheduledAt', 'ASC']],
    limit: Math.min(parseInt(query.limit, 10) || 50, 200),
  });
}

async function suggestedStaff(id) {
  const booking = await findDetailed(id);
  return suggestStaffForBooking(booking);
}

async function assign(id, staffId, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'assign');

  const staff = await Staff.findOne({ where: { id: staffId, approvalStatus: 'APPROVED' } });
  if (!staff) throw AppError.badRequest('Selected staff member is not approved/available for assignment');

  booking.staffId = staff.id;
  booking.status = 'ASSIGNED';
  await booking.save();

  await logAudit({
    userId: actorUser.id,
    action: 'BOOKING_ASSIGNED',
    entityType: 'Booking',
    entityId: booking.id,
    req,
    metadata: { staffId: staff.id },
  });

  return findDetailed(booking.id);
}

async function accept(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'accept');

  booking.status = 'ACCEPTED';
  await booking.save();

  await logAudit({ userId: actorUser.id, action: 'BOOKING_ACCEPTED', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
}

async function reject(id, reason, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'reject');

  booking.status = 'REJECTED';
  booking.cancellationReason = reason || null;
  booking.staffId = null; // free the slot so ops can reassign someone else
  await booking.save();

  await logAudit({
    userId: actorUser.id,
    action: 'BOOKING_REJECTED',
    entityType: 'Booking',
    entityId: booking.id,
    req,
    metadata: { reason: reason || null },
  });
  return findDetailed(booking.id);
}

async function onTheWay(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'onTheWay');

  booking.status = 'ON_THE_WAY';
  await booking.save();

  await logAudit({ userId: actorUser.id, action: 'BOOKING_ON_THE_WAY', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
}

async function arrive(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'arrive');

  booking.status = 'ARRIVED';
  await booking.save();

  await logAudit({ userId: actorUser.id, action: 'BOOKING_ARRIVED', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
}

async function start(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'start');

  booking.status = 'IN_PROGRESS';
  await booking.save();

  await logAudit({ userId: actorUser.id, action: 'BOOKING_STARTED', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
}

async function complete(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'complete');

  booking.status = 'COMPLETED';
  await booking.save();

  await logAudit({ userId: actorUser.id, action: 'BOOKING_COMPLETED', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
  // Note: the clinical Visit record (check-in/out, vitals, notes) is
  // Phase 6's job — this only closes out the booking lifecycle.
}

async function cancel(id, reason, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'cancel');

  booking.status = 'CANCELLED';
  booking.cancellationReason = reason;
  await booking.save();

  await logAudit({
    userId: actorUser.id,
    action: 'BOOKING_CANCELLED',
    entityType: 'Booking',
    entityId: booking.id,
    req,
    metadata: { reason },
  });
  return findDetailed(booking.id);
}

async function reschedule(id, scheduledAt, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'reschedule');

  const newTime = new Date(scheduledAt);
  if (Number.isNaN(newTime.getTime()) || newTime < new Date()) {
    throw AppError.badRequest('scheduledAt must be a valid time in the future');
  }

  booking.status = 'RESCHEDULED';
  booking.scheduledAt = newTime;
  booking.staffId = null; // needs re-assignment against the new time
  await booking.save();

  await logAudit({
    userId: actorUser.id,
    action: 'BOOKING_RESCHEDULED',
    entityType: 'Booking',
    entityId: booking.id,
    req,
    metadata: { scheduledAt: newTime },
  });
  return findDetailed(booking.id);
}

module.exports = {
  create,
  list,
  getOne,
  mySchedule,
  suggestedStaff,
  assign,
  accept,
  reject,
  onTheWay,
  arrive,
  start,
  complete,
  cancel,
  reschedule,
};
