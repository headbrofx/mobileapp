'use strict';

const { Op } = require('sequelize');
const { Booking, ClientProfile, Staff, FamilyMember, Service, User } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { assertTransition, ALLOWED_FROM } = require('./bookingStateMachine.service');
const { suggestStaffForBooking, recommendForBooking } = require('./staffMatch.service');
const { notify } = require('./notification.service');
const careEvents = require('./careEvents.service');
const history = require('./statusHistory.service');
const settings = require('./settings.service');
const zones = require('./zone.service');
const availability = require('./staffAvailability.service');
const erpBridge = require('./erpBridge.service');
const logger = require('../config/logger');
const { isReferenceCollision } = require('../utils/reference');
const { DETAIL_INCLUDE } = require('../middleware/bookingAccess');

async function findDetailed(id) {
  const booking = await Booking.findByPk(id, { include: DETAIL_INCLUDE });
  if (!booking) throw AppError.notFound('Booking not found');
  return booking;
}

// Tell the client when somebody else moves their booking along. The
// transitions a client performs themselves are left alone: nobody needs
// a notification about the thing they just did.
async function notifyClient(booking, title, message, event) {
  const clientProfile = await ClientProfile.findByPk(booking.clientProfileId);
  if (!clientProfile) return;
  await careEvents.toUser(clientProfile.userId, {
    title,
    message,
    event: event || 'BOOKING_UPDATED',
    data: { bookingId: booking.id, reference: booking.bookingReference, status: booking.status },
  });
}

async function assertSchedulable(scheduledAt) {
  if (Number.isNaN(scheduledAt.getTime())) {
    throw AppError.badRequest('scheduledAt must be a valid time in the future');
  }
  const [leadMinutes, maxDays] = await Promise.all([
    settings.get('booking.minLeadMinutes'),
    settings.get('booking.maxAdvanceDays'),
  ]);
  const now = Date.now();
  if (scheduledAt.getTime() < now) {
    throw AppError.badRequest('scheduledAt must be a valid time in the future');
  }
  if (scheduledAt.getTime() < now + leadMinutes * 60 * 1000) {
    throw new AppError(
      `Tunahitaji angalau dakika ${leadMinutes} kupanga muuguzi. Kwa dharura, nenda kituo cha afya au piga 112. / We need at least ${leadMinutes} minutes to arrange a visit. For an emergency, go to a health facility or call 112.`,
      422,
      'TOO_SOON'
    );
  }
  if (scheduledAt.getTime() > now + maxDays * 24 * 3600 * 1000) {
    throw new AppError(`Ombi linaweza kuwa hadi siku ${maxDays} mbele. / Requests can be up to ${maxDays} days ahead.`, 422, 'TOO_FAR_AHEAD');
  }
}

// familyMemberId comes from the request body (not the URL), so ownership
// can't be checked by the loadOwnedFamilyMember middleware — verified here
// instead, against the requesting client's own ClientProfile.
//
// Idempotent when the app sends a key: the same key from the same
// client returns the booking the first attempt made, rather than a
// second one. A double tap, or a retry after a timeout on a slow line,
// is the normal way a client ends up with two nurses coming.
//
// Returns { booking, replayed }.
async function create(user, data, { idempotencyKey = null } = {}) {
  const clientProfile = await ClientProfile.findOne({ where: { userId: user.id } });
  if (!clientProfile) throw AppError.badRequest('No client profile for this account');

  if (idempotencyKey) {
    const existing = await Booking.findOne({ where: { clientProfileId: clientProfile.id, idempotencyKey } });
    if (existing) return { booking: await findDetailed(existing.id), replayed: true };
  }

  const familyMember = await FamilyMember.findOne({
    where: { id: data.familyMemberId, clientProfileId: clientProfile.id },
  });
  if (!familyMember) throw AppError.notFound('Family member not found');

  const service = await Service.findOne({ where: { id: data.serviceId, isActive: true } });
  if (!service) throw AppError.notFound('Service not found');

  const scheduledAt = new Date(data.scheduledAt);
  await assertSchedulable(scheduledAt);

  const zone = await zones.assertCovered(data.locationLat, data.locationLng, 'homeVisits');

  let booking;
  for (let attempt = 0; attempt < 3 && !booking; attempt += 1) {
    try {
      booking = await Booking.create({
        clientProfileId: clientProfile.id,
        familyMemberId: familyMember.id,
        serviceId: service.id,
        status: 'REQUESTED',
        locationAddress: data.locationAddress,
        locationLat: data.locationLat ?? null,
        locationLng: data.locationLng ?? null,
        locationDetails: data.locationDetails || null,
        accessibilityNotes: data.accessibilityNotes || null,
        timeWindow: data.timeWindow || null,
        scheduledAt,
        notes: data.notes || null,
        createdByUserId: user.id,
        serviceZoneId: zone ? zone.id : null,
        // The list price at the time of asking, so a later price change
        // does not rewrite what the client was shown. The confirmed
        // price is set by a person, never inferred.
        quotedPriceTzs: service.basePriceTzs ?? null,
        idempotencyKey,
      });
    } catch (err) {
      if (isReferenceCollision(err)) continue;
      // Two requests with the same key raced past the lookup above; the
      // unique index let exactly one in. Hand back that one.
      if (idempotencyKey && err.name === 'SequelizeUniqueConstraintError') {
        const winner = await Booking.findOne({ where: { clientProfileId: clientProfile.id, idempotencyKey } });
        if (winner) return { booking: await findDetailed(winner.id), replayed: true };
      }
      throw err;
    }
  }
  if (!booking) throw new AppError('Could not allocate a booking reference', 503, 'REFERENCE_UNAVAILABLE');

  await history.record({ entityType: 'BOOKING', entityId: booking.id, toStatus: 'REQUESTED', actorUserId: user.id });

  await logAudit({
    userId: user.id,
    action: 'BOOKING_CREATED',
    entityType: 'Booking',
    entityId: booking.id,
    metadata: { serviceId: service.id, familyMemberId: familyMember.id, reference: booking.bookingReference },
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

  return { booking: await findDetailed(booking.id), replayed: false };
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
        message: `${booking.bookingReference} — ${familyMember.name} — ${when} — ${booking.locationAddress}`,
        // The id travels with it so whatever reads these can open the
        // booking directly rather than searching for it.
        data: {
          bookingId: booking.id,
          reference: booking.bookingReference,
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

const OPEN_STATUSES = ['REQUESTED', 'UNDER_REVIEW', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];

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

// Every transition goes through here: check it is allowed, apply it,
// write the history row and the audit row, tell the client if asked.
async function transition(id, action, actorUser, req, { mutate, audit = {}, note = null, clientMessage = null } = {}) {
  const booking = await Booking.findByPk(id);
  if (!booking) throw AppError.notFound('Booking not found');
  const target = assertTransition(booking, action);
  const from = booking.status;

  booking.status = target;
  if (mutate) await mutate(booking);
  await booking.save();

  await history.record({
    entityType: 'BOOKING',
    entityId: booking.id,
    fromStatus: from,
    toStatus: target,
    actorUserId: actorUser ? actorUser.id : null,
    note,
  });

  if (audit.action) {
    await logAudit({
      userId: actorUser ? actorUser.id : null,
      action: audit.action,
      entityType: 'Booking',
      entityId: booking.id,
      req,
      metadata: audit.metadata || {},
    });
  }

  if (clientMessage) await notifyClient(booking, clientMessage.title, clientMessage.message, clientMessage.event);

  return booking;
}

async function review(id, actorUser, req) {
  await transition(id, 'review', actorUser, req, {
    audit: { action: 'BOOKING_UNDER_REVIEW' },
    clientMessage: {
      title: 'Ombi lako linapitiwa',
      message: 'Mtaalamu wetu anapitia ombi lako na kumtafuta muuguzi.',
      event: 'BOOKING_UNDER_REVIEW',
    },
  });
  return findDetailed(id);
}

// Assign a staff member. The server, not the screen, decides whether
// the person can take the slot: someone already booked at that time, or
// marked away, is refused here whoever asks.
//
// `overrideReason` is the dispatcher's explanation when they choose
// somebody other than the top recommendation. The Dispatch Center
// requires it in that case (see dispatch.service); this records it.
async function assign(id, staffId, actorUser, req, { overrideReason = null, requireReasonForOverride = false } = {}) {
  const booking = await Booking.findByPk(id, { include: DETAIL_INCLUDE });
  if (!booking) throw AppError.notFound('Booking not found');
  assertTransition(booking, 'assign');

  const staff = await Staff.findOne({ where: { id: staffId, approvalStatus: 'APPROVED' } });
  if (!staff) throw AppError.badRequest('Selected staff member is not approved/available for assignment');

  if (availability.isMarkedAway(staff, booking.scheduledAt)) {
    throw AppError.conflict('This staff member is marked unavailable at that time', 'STAFF_UNAVAILABLE');
  }
  const conflicts = await availability.findConflicts(staff.id, booking.scheduledAt, { excludeBookingId: booking.id });
  if (conflicts.length) {
    throw AppError.conflict(
      'This staff member already has a visit or trip at that time',
      'SCHEDULE_CONFLICT',
      conflicts.map((c) => ({ reference: c.reference, kind: c.kind, scheduledAt: c.scheduledAt }))
    );
  }

  const ranked = await recommendForBooking(booking);
  const top = ranked.find((c) => c.eligible) || null;
  const chosen = ranked.find((c) => c.id === staff.id) || null;
  const followedRecommendation = Boolean(top && top.id === staff.id);
  if (requireReasonForOverride && top && !followedRecommendation && !(overrideReason && overrideReason.trim().length >= 3)) {
    throw AppError.badRequest('Give a reason for choosing someone other than the recommended staff member', [
      { field: 'overrideReason', message: 'Required when not following the recommendation' },
    ]);
  }

  await transition(id, 'assign', actorUser, req, {
    mutate: (b) => {
      b.staffId = staff.id;
    },
    note: followedRecommendation ? null : overrideReason || null,
    audit: {
      action: 'BOOKING_ASSIGNED',
      metadata: {
        staffId: staff.id,
        followedRecommendation,
        recommendedStaffId: top ? top.id : null,
        rank: chosen ? chosen.rank : null,
        overrideReason: followedRecommendation ? null : overrideReason || null,
      },
    },
    clientMessage: {
      title: 'Muuguzi amepangiwa',
      message: 'Ombi lako la ziara limepangiwa muuguzi.',
      event: 'BOOKING_ASSIGNED',
    },
  });

  // Tell the nurse too. Until now the only way to find out was to open
  // the schedule.
  await careEvents.toUser(staff.userId, {
    title: 'Umepangiwa ziara',
    message: `${booking.bookingReference} — tafadhali kubali au kataa.`,
    event: 'BOOKING_ASSIGNED_TO_STAFF',
    data: { bookingId: booking.id, reference: booking.bookingReference },
  });

  return findDetailed(id);
}

async function accept(id, actorUser, req) {
  await transition(id, 'accept', actorUser, req, {
    audit: { action: 'BOOKING_ACCEPTED' },
    clientMessage: { title: 'Muuguzi amekubali', message: 'Muuguzi amekubali kuja kwenye ziara yako.', event: 'BOOKING_ACCEPTED' },
  });
  return findDetailed(id);
}

async function reject(id, reason, actorUser, req) {
  await transition(id, 'reject', actorUser, req, {
    mutate: (b) => {
      b.cancellationReason = reason || null;
      b.staffId = null; // free the slot so ops can reassign someone else
    },
    note: reason || null,
    audit: { action: 'BOOKING_REJECTED', metadata: { reason: reason || null } },
  });
  await careEvents.toDesk({
    title: 'Muuguzi amekataa ziara',
    message: 'Ziara inahitaji kupangiwa mtu mwingine.',
    event: 'BOOKING_REJECTED_BY_STAFF',
    data: { bookingId: id },
  });
  return findDetailed(id);
}

async function onTheWay(id, actorUser, req) {
  await transition(id, 'onTheWay', actorUser, req, {
    audit: { action: 'BOOKING_ON_THE_WAY' },
    clientMessage: { title: 'Muuguzi yupo njiani', message: 'Muuguzi wako ameanza safari kuja kwako.', event: 'BOOKING_ON_THE_WAY' },
  });
  return findDetailed(id);
}

async function arrive(id, actorUser, req) {
  await transition(id, 'arrive', actorUser, req, {
    audit: { action: 'BOOKING_ARRIVED' },
    clientMessage: { title: 'Muuguzi amefika', message: 'Muuguzi wako amefika mahali ulipoandika.', event: 'BOOKING_ARRIVED' },
  });
  return findDetailed(id);
}

async function start(id, actorUser, req) {
  await transition(id, 'start', actorUser, req, { audit: { action: 'BOOKING_STARTED' } });
  return findDetailed(id);
}

async function complete(id, actorUser, req) {
  await transition(id, 'complete', actorUser, req, {
    audit: { action: 'BOOKING_COMPLETED' },
    clientMessage: {
      title: 'Ziara imekamilika',
      message: 'Ziara yako imekamilika. Asante kwa kutumia Afya Nyumbani.',
      event: 'BOOKING_COMPLETED',
    },
  });
  return findDetailed(id);
  // Note: the clinical Visit record (check-in/out, vitals, notes) is
  // Phase 6's job — this only closes out the booking lifecycle.
}

async function cancel(id, reason, actorUser, req) {
  const byClient = actorUser && actorUser.role === 'CLIENT';
  await transition(id, 'cancel', actorUser, req, {
    mutate: (b) => {
      b.cancellationReason = reason;
    },
    note: reason,
    audit: { action: 'BOOKING_CANCELLED', metadata: { reason } },
    clientMessage: byClient
      ? null
      : { title: 'Ziara imesitishwa', message: 'Ziara yako imesitishwa na Afya Nyumbani.', event: 'BOOKING_CANCELLED' },
  });
  if (byClient) {
    await careEvents.toDesk({
      title: 'Mteja amesitisha ziara',
      message: reason,
      event: 'BOOKING_CANCELLED_BY_CLIENT',
      data: { bookingId: id },
    });
  }
  return findDetailed(id);
}

async function reschedule(id, scheduledAt, actorUser, req) {
  const newTime = new Date(scheduledAt);
  await assertSchedulable(newTime);

  await transition(id, 'reschedule', actorUser, req, {
    mutate: (b) => {
      b.scheduledAt = newTime;
      b.staffId = null; // needs re-assignment against the new time
    },
    audit: { action: 'BOOKING_RESCHEDULED', metadata: { scheduledAt: newTime } },
  });
  return findDetailed(id);
}

async function fail(id, reason, actorUser, req) {
  await transition(id, 'fail', actorUser, req, {
    mutate: (b) => {
      b.cancellationReason = reason;
    },
    note: reason,
    audit: { action: 'BOOKING_FAILED', metadata: { reason } },
    clientMessage: {
      title: 'Ziara haikufanyika',
      message: 'Samahani, ziara yako haikuweza kufanyika. Tutawasiliana nawe kupanga upya.',
      event: 'BOOKING_FAILED',
    },
  });
  return findDetailed(id);
}

// The sweep: requests nobody dispatched in time become EXPIRED, and the
// client is told rather than left waiting for a nurse who is not coming.
// Runs when the Dispatch Center loads its queue (and may be run from a
// scheduler); safe to run any number of times.
async function expireOverdue() {
  const graceMinutes = await settings.get('dispatch.expireAfterMinutes');
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const overdue = await Booking.findAll({
    where: { status: { [Op.in]: ALLOWED_FROM.expire }, scheduledAt: { [Op.lt]: cutoff } },
    attributes: ['id'],
    limit: 200,
  });

  let expired = 0;
  for (const { id } of overdue) {
    try {
      await transition(id, 'expire', null, null, {
        note: 'Hakuna aliyepangiwa kabla ya muda kupita',
        audit: { action: 'BOOKING_EXPIRED' },
        clientMessage: {
          title: 'Ombi limepitwa na muda',
          message: 'Samahani, hatukuweza kupanga muuguzi kwa muda uliochagua. Tafadhali omba tena.',
          event: 'BOOKING_EXPIRED',
        },
      });
      expired += 1;
    } catch (err) {
      // Moved on by somebody else between the query and now. Fine.
      if (err.statusCode !== 409) throw err;
    }
  }
  return expired;
}

module.exports = {
  create,
  list,
  getOne,
  mySchedule,
  suggestedStaff,
  review,
  assign,
  accept,
  reject,
  onTheWay,
  arrive,
  start,
  complete,
  cancel,
  reschedule,
  fail,
  expireOverdue,
  findDetailed,
  OPEN_STATUSES,
};
