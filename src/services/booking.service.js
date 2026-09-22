'use strict';

const { Op } = require('sequelize');
const { Booking, ClientProfile, Staff, FamilyMember, Service, User } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { assertTransition } = require('./bookingStateMachine.service');
const { suggestStaffForBooking } = require('./staffMatch.service');
const { notify } = require('./notification.service');
const erpBridge = require('./erpBridge.service');
const logger = require('../config/logger');
const { DETAIL_INCLUDE } = require('../middleware/bookingAccess');

async function findDetailed(id) {
  const booking = await Booking.findByPk(id, { include: DETAIL_INCLUDE });
  if (!booking) throw AppError.notFound('Booking not found');
  return booking;
}

// Tell the client when somebody else moves their booking along. The
// transitions a client performs themselves are left alone: nobody needs
// a notification about the thing they just did.
async function notifyClient(booking, title, message) {
  const clientProfile = await ClientProfile.findByPk(booking.clientProfileId);
  if (!clientProfile) return;
  await notify({
    userId: clientProfile.userId,
    type: 'BOOKING',
    title,
    message,
    data: { bookingId: booking.id },
  });
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

  await notifyDesk(booking, service, familyMember, user);

  // Into the business's own management software, if it is wired up.
  //
  // Not awaited. The ERP is a separate deployment on a separate host,
  // and a client who has just asked for a nurse should not be left
  // watching a spinner while we talk to another server that may be
  // cold, slow or down. It logs and audits its own outcome.
  erpBridge
    .sendBooking({ booking, service, familyMember, client: user })
    .catch((err) => logger.error('ERP bridge threw', { bookingId: booking.id, message: err.message }));

  return findDetailed(booking.id);
}

// Tell the business an order has arrived.
//
// Until now nothing did. Every other step of a booking notified the
// client — assigned, accepted, on the way — but the step where a
// stranger asks for a nurse to come to their house notified nobody at
// all. The row was written with status REQUESTED and sat there until
// somebody happened to look, and there is no screen that looks.
//
// So this is the floor, not the finished thing: every admin now gets a
// notification the moment an order lands, carrying enough to act on
// without opening anything else — who, what, when and where.
//
// It writes in-app notifications because that is the only channel this
// system has; notification.service pushes nothing. A phone that rings
// is a separate piece of work and needs a gateway.
async function notifyDesk(booking, service, familyMember, orderedBy) {
  const admins = await User.findAll({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    attributes: ['id'],
  });
  if (admins.length === 0) return;

  const when = booking.scheduledAt.toLocaleString('sw-TZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: admin.id,
        type: 'BOOKING',
        title: `Ombi jipya: ${service.name}`,
        message: `${familyMember.name} — ${when} — ${booking.locationAddress}`,
        // The id travels with it so whatever reads these can open the
        // booking directly rather than searching for it.
        data: {
          bookingId: booking.id,
          serviceId: service.id,
          serviceName: service.name,
          patientName: familyMember.name,
          orderedByUserId: orderedBy.id,
          scheduledAt: booking.scheduledAt,
          locationAddress: booking.locationAddress,
          status: booking.status,
        },
      })
    )
  );
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

  await notifyClient(booking, 'Muuguzi amepangiwa', 'Ombi lako la ziara limepangiwa muuguzi.');

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

  await notifyClient(booking, 'Muuguzi amekubali', 'Muuguzi amekubali kuja kwenye ziara yako.');
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

  await notifyClient(booking, 'Muuguzi yupo njiani', 'Muuguzi wako ameanza safari kuja kwako.');
  await logAudit({ userId: actorUser.id, action: 'BOOKING_ON_THE_WAY', entityType: 'Booking', entityId: booking.id, req });
  return findDetailed(booking.id);
}

async function arrive(id, actorUser, req) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'arrive');

  booking.status = 'ARRIVED';
  await booking.save();

  await notifyClient(booking, 'Muuguzi amefika', 'Muuguzi wako amefika mahali ulipoandika.');
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

  await notifyClient(booking, 'Ziara imekamilika', 'Ziara yako imekamilika. Asante kwa kutumia Afya Nyumbani.');
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
