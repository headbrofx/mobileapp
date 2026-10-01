'use strict';

const { Op } = require('sequelize');
const { TransportRequest, ClientProfile, FamilyMember, Staff, User, ServiceZone } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const sm = require('./transportStateMachine.service');
const history = require('./statusHistory.service');
const settings = require('./settings.service');
const zones = require('./zone.service');
const careEvents = require('./careEvents.service');
const availability = require('./staffAvailability.service');
const redFlags = require('./aiRedFlags.service');
const partners = require('../integrations/transport');
const logger = require('../config/logger');
const { isReferenceCollision } = require('../utils/reference');

const INCLUDE = [
  { model: FamilyMember, as: 'patient', attributes: ['id', 'name', 'relationship'] },
  { model: ServiceZone, as: 'zone', attributes: ['id', 'name', 'region'] },
  {
    model: Staff,
    as: 'driver',
    attributes: ['id', 'userId'],
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  },
];

// What a client is shown. The driver's phone stays with the dispatcher
// (same rule as a nurse's: the client reaches them through Afya
// Nyumbani), and the partner's internal reference and our idempotency
// key are nobody's business on the client's screen.
function toClientView(trip) {
  const t = trip.toJSON ? trip.toJSON() : { ...trip };
  delete t.driverPhone;
  delete t.partnerReference;
  delete t.idempotencyKey;
  delete t.createdByUserId;
  if (t.driver) {
    t.driver = { id: t.driver.id, name: t.driver.user ? t.driver.user.name : null };
  }
  return t;
}

function viewFor(user, trip) {
  return user.role === 'ADMIN' ? trip : toClientView(trip);
}

async function findDetailed(id) {
  const trip = await TransportRequest.findByPk(id, { include: INCLUDE });
  if (!trip) throw AppError.notFound('Transport request not found');
  return trip;
}

// Who may see a trip: an admin, the client who asked for it, or the
// staff member driving it. Everybody else gets 403, including another
// client who has guessed an id.
async function assertAccess(user, trip, { owner = false, driver = false } = {}) {
  if (user.role === 'ADMIN') return 'ADMIN';

  if (user.role === 'CLIENT') {
    const profile = await ClientProfile.findOne({ where: { userId: user.id } });
    if (profile && profile.id === trip.clientProfileId) return 'OWNER';
  }

  if (user.role === 'STAFF' && (driver || !owner)) {
    const staff = await Staff.findOne({ where: { userId: user.id } });
    if (staff && trip.assignedStaffId && staff.id === trip.assignedStaffId) return 'DRIVER';
  }

  throw AppError.forbidden('You do not have access to this transport request');
}

async function notifyClient(trip, title, message, event) {
  const profile = await ClientProfile.findByPk(trip.clientProfileId);
  if (!profile) return;
  await careEvents.toUser(profile.userId, {
    title,
    message,
    event,
    data: { transportId: trip.id, reference: trip.bookingReference, status: trip.status },
  });
}

async function create(user, data, { idempotencyKey = null } = {}) {
  const profile = await ClientProfile.findOne({ where: { userId: user.id } });
  if (!profile) throw AppError.badRequest('No client profile for this account');

  if (idempotencyKey) {
    const existing = await TransportRequest.findOne({ where: { clientProfileId: profile.id, idempotencyKey } });
    if (existing) return { trip: toClientView(await findDetailed(existing.id)), replayed: true };
  }

  if (!(await settings.get('transport.enabled'))) {
    throw new AppError('Huduma ya usafiri haipatikani kwa sasa. / Transport is not available right now.', 503, 'TRANSPORT_DISABLED');
  }

  const patient = await FamilyMember.findOne({ where: { id: data.familyMemberId, clientProfileId: profile.id } });
  if (!patient) throw AppError.notFound('Family member not found');

  const maxPassengers = await settings.get('transport.maxPassengers');
  if ((data.passengerCount || 1) > maxPassengers) {
    throw AppError.badRequest(`At most ${maxPassengers} passengers per request`);
  }

  // Scheduled transport is not an ambulance, and must not be mistaken
  // for one. If what they wrote reads like an emergency, stop and say
  // so, unless they have already seen this and said it is not.
  const flagged = redFlags.detect([data.notes, data.mobilityNeeds].filter(Boolean).join(' '));
  if (flagged.isRedFlag && !data.acknowledgedNotEmergency) {
    throw new AppError(
      'Hii inaonekana kuwa dharura. Usisubiri usafiri uliopangwa: piga 112 au nenda kituo cha afya kilicho karibu sasa. / This looks like an emergency. Do not wait for scheduled transport: call 112 or go to the nearest health facility now.',
      422,
      'EMERGENCY_DETECTED',
      [{ field: 'notes', message: flagged.matches.map((m) => m.label).join(', ') }]
    );
  }

  const scheduledAt = new Date(data.scheduledAt);
  const lead = await settings.get('booking.minLeadMinutes');
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + lead * 60 * 1000) {
    throw new AppError(
      `Usafiri unahitaji kuombwa angalau dakika ${lead} kabla. / Transport must be requested at least ${lead} minutes ahead.`,
      422,
      'TOO_SOON'
    );
  }

  const zone = await zones.assertCovered(data.pickupLat, data.pickupLng, 'transport');

  let trip;
  for (let attempt = 0; attempt < 3 && !trip; attempt += 1) {
    try {
      trip = await TransportRequest.create({
        clientProfileId: profile.id,
        familyMemberId: patient.id,
        createdByUserId: user.id,
        serviceZoneId: zone ? zone.id : null,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat ?? null,
        pickupLng: data.pickupLng ?? null,
        pickupDetails: data.pickupDetails || null,
        destinationType: data.destinationType,
        destinationName: data.destinationName,
        destinationAddress: data.destinationAddress || null,
        destinationLat: data.destinationLat ?? null,
        destinationLng: data.destinationLng ?? null,
        passengerCount: data.passengerCount || 1,
        scheduledAt,
        mobilityNeeds: data.mobilityNeeds || null,
        companionName: data.companionName || null,
        contactPhone: data.contactPhone,
        notes: data.notes || null,
        status: 'REQUESTED',
        idempotencyKey,
      });
    } catch (err) {
      if (isReferenceCollision(err)) continue;
      if (idempotencyKey && err.name === 'SequelizeUniqueConstraintError') {
        const winner = await TransportRequest.findOne({ where: { clientProfileId: profile.id, idempotencyKey } });
        if (winner) return { trip: toClientView(await findDetailed(winner.id)), replayed: true };
      }
      throw err;
    }
  }
  if (!trip) throw new AppError('Could not allocate a reference', 503, 'REFERENCE_UNAVAILABLE');

  await history.record({ entityType: 'TRANSPORT', entityId: trip.id, toStatus: 'REQUESTED', actorUserId: user.id });
  await logAudit({
    userId: user.id,
    action: 'TRANSPORT_REQUESTED',
    entityType: 'TransportRequest',
    entityId: trip.id,
    metadata: { reference: trip.bookingReference, familyMemberId: patient.id, destinationType: trip.destinationType },
  });

  await careEvents.toDesk({
    title: 'Ombi jipya la usafiri',
    message: `${trip.bookingReference} — ${patient.name} — ${trip.destinationName}`,
    event: 'TRANSPORT_REQUESTED',
    data: { transportId: trip.id, reference: trip.bookingReference },
  });

  // If a partner is connected, ask it for a price now so the dispatcher
  // opens the request with a real quote beside it. Not awaited and not
  // applied: a person still sends the quote to the client.
  if (partners.active().isConfigured()) {
    partners
      .active()
      .requestQuote(trip)
      .then((r) => logAudit({ action: 'TRANSPORT_PARTNER_QUOTE', entityType: 'TransportRequest', entityId: trip.id, metadata: { status: r.status, fareTzs: r.fareTzs ?? null } }))
      .catch((err) => logger.error('Partner quote failed', { transportId: trip.id, message: err.message }));
  }

  return { trip: toClientView(await findDetailed(trip.id)), replayed: false };
}

async function list(user, query = {}) {
  const where = {};
  if (query.status) where.status = query.status;

  if (user.role === 'CLIENT') {
    const profile = await ClientProfile.findOne({ where: { userId: user.id } });
    where.clientProfileId = profile ? profile.id : '00000000-0000-0000-0000-000000000000';
  } else if (user.role === 'STAFF') {
    const staff = await Staff.findOne({ where: { userId: user.id } });
    where.assignedStaffId = staff ? staff.id : '00000000-0000-0000-0000-000000000000';
  }

  const trips = await TransportRequest.findAll({
    where,
    include: INCLUDE,
    order: [['scheduledAt', 'DESC']],
    limit: Math.min(parseInt(query.limit, 10) || 50, 200),
  });
  return trips.map((t) => viewFor(user, t));
}

async function getOne(user, id) {
  const trip = await findDetailed(id);
  await assertAccess(user, trip);
  return viewFor(user, trip);
}

async function transition(trip, action, actorUser, req, { mutate, note = null, audit = {}, clientMessage = null } = {}) {
  const target = sm.assertTransition(trip, action);
  const from = trip.status;
  trip.status = target;
  if (mutate) await mutate(trip);
  await trip.save();

  await history.record({
    entityType: 'TRANSPORT',
    entityId: trip.id,
    fromStatus: from,
    toStatus: target,
    actorUserId: actorUser ? actorUser.id : null,
    note,
  });
  await logAudit({
    userId: actorUser ? actorUser.id : null,
    action: audit.action || `TRANSPORT_${target}`,
    entityType: 'TransportRequest',
    entityId: trip.id,
    req,
    metadata: audit.metadata || {},
  });
  if (clientMessage) await notifyClient(trip, clientMessage.title, clientMessage.message, clientMessage.event);
  return trip;
}

async function load(id) {
  const trip = await TransportRequest.findByPk(id);
  if (!trip) throw AppError.notFound('Transport request not found');
  return trip;
}

// --- Dispatcher actions ---------------------------------------------------

async function review(id, actorUser, req) {
  const trip = await load(id);
  await transition(trip, 'review', actorUser, req, {
    clientMessage: { title: 'Ombi la usafiri linapitiwa', message: 'Tunapanga usafiri wako na tutakutumia bei.', event: 'TRANSPORT_UNDER_REVIEW' },
  });
  return findDetailed(id);
}

// The fare is what a person typed (or a partner actually returned and
// a person forwarded). The client must accept it before anything is
// booked.
async function quote(id, { fareTzs, note }, actorUser, req) {
  const trip = await load(id);
  await transition(trip, 'quote', actorUser, req, {
    mutate: (t) => {
      t.quotedFareTzs = fareTzs;
      t.quoteNote = note || null;
    },
    note: `TZS ${fareTzs}`,
    audit: { action: 'TRANSPORT_QUOTED', metadata: { fareTzs } },
    clientMessage: {
      title: 'Bei ya usafiri iko tayari',
      message: `Usafiri wako: TZS ${fareTzs.toLocaleString('en-US')}. Fungua ombi ukubali au ukatae.`,
      event: 'TRANSPORT_QUOTED',
    },
  });
  return findDetailed(id);
}

async function reject(id, reason, actorUser, req) {
  const trip = await load(id);
  await transition(trip, 'reject', actorUser, req, {
    mutate: (t) => {
      t.cancellationReason = reason;
    },
    note: reason,
    audit: { metadata: { reason } },
    clientMessage: { title: 'Ombi la usafiri halikukubaliwa', message: reason, event: 'TRANSPORT_REJECTED' },
  });
  return findDetailed(id);
}

// Assign a vehicle. Either one of our own staff drives (staffId), or the
// trip goes to a partner company. With a partner adapter connected,
// the booking is made through it; without one, the dispatcher has
// arranged it by phone and types what the company told them.
async function assign(id, data, actorUser, req) {
  const trip = await load(id);
  sm.assertTransition(trip, 'assign');

  let staff = null;
  if (data.staffId) {
    staff = await Staff.findOne({ where: { id: data.staffId, approvalStatus: 'APPROVED' } });
    if (!staff) throw AppError.badRequest('Selected staff member is not approved');
    if (availability.isMarkedAway(staff, trip.scheduledAt)) {
      throw AppError.conflict('This staff member is marked unavailable at that time', 'STAFF_UNAVAILABLE');
    }
    const conflicts = await availability.findConflicts(staff.id, trip.scheduledAt, { excludeTransportId: trip.id });
    if (conflicts.length) {
      throw AppError.conflict(
        'This staff member already has a visit or trip at that time',
        'SCHEDULE_CONFLICT',
        conflicts.map((c) => ({ reference: c.reference, kind: c.kind, scheduledAt: c.scheduledAt }))
      );
    }
  }

  let partnerResult = null;
  const adapter = partners.active();
  if (!staff && data.usePartnerApi) {
    partnerResult = await adapter.bookTrip(trip);
    if (partnerResult.status !== 'OK') {
      throw new AppError(
        `The transport partner integration answered ${partnerResult.status}. Arrange the trip by phone and enter the details instead.`,
        502,
        'PARTNER_' + partnerResult.status
      );
    }
  }

  await transition(trip, 'assign', actorUser, req, {
    mutate: (t) => {
      t.assignedStaffId = staff ? staff.id : null;
      t.partnerName = staff ? null : data.partnerName || adapter.name() || null;
      t.partnerReference = staff ? null : partnerResult?.partnerReference || data.partnerReference || null;
      t.driverName = staff ? null : partnerResult?.driverName || data.driverName || null;
      t.driverPhone = staff ? null : partnerResult?.driverPhone || data.driverPhone || null;
      t.vehicleDetails = partnerResult?.vehicleDetails || data.vehicleDetails || null;
    },
    audit: {
      action: 'TRANSPORT_ASSIGNED',
      metadata: { staffId: staff ? staff.id : null, partner: staff ? null : data.partnerName || adapter.name(), viaApi: Boolean(partnerResult) },
    },
    clientMessage: { title: 'Usafiri umepangwa', message: 'Gari limepangwa kwa safari yako.', event: 'TRANSPORT_ASSIGNED' },
  });

  if (staff) {
    await careEvents.toUser(staff.userId, {
      title: 'Umepangiwa safari',
      message: `${trip.bookingReference} — fungua kuona maelezo.`,
      event: 'TRANSPORT_ASSIGNED_TO_STAFF',
      data: { transportId: trip.id },
    });
  }
  return findDetailed(id);
}

async function fail(id, reason, actorUser, req) {
  const trip = await load(id);
  await transition(trip, 'fail', actorUser, req, {
    mutate: (t) => {
      t.cancellationReason = reason;
    },
    note: reason,
    audit: { metadata: { reason } },
    clientMessage: {
      title: 'Safari haikufanyika',
      message: 'Samahani, safari yako haikukamilika. Tutawasiliana nawe.',
      event: 'TRANSPORT_FAILED',
    },
  });
  return findDetailed(id);
}

// --- Client actions -------------------------------------------------------

async function acceptQuote(user, id, req) {
  const trip = await load(id);
  await assertAccess(user, trip, { owner: true });
  await transition(trip, 'acceptQuote', user, req, {
    mutate: (t) => {
      t.confirmedFareTzs = t.quotedFareTzs;
    },
    audit: { metadata: { fareTzs: trip.quotedFareTzs } },
  });
  await careEvents.toDesk({
    title: 'Mteja amekubali bei ya usafiri',
    message: `${trip.bookingReference} — panga gari.`,
    event: 'TRANSPORT_QUOTE_ACCEPTED',
    data: { transportId: trip.id },
  });
  return viewFor(user, await findDetailed(id));
}

async function declineQuote(user, id, reason, req) {
  const trip = await load(id);
  await assertAccess(user, trip, { owner: true });
  await transition(trip, 'declineQuote', user, req, {
    mutate: (t) => {
      t.cancellationReason = reason || 'Bei haikukubaliwa';
    },
    note: reason || null,
  });
  return viewFor(user, await findDetailed(id));
}

async function cancel(user, id, reason, req) {
  const trip = await load(id);
  const role = await assertAccess(user, trip, { owner: true });
  if (role === 'DRIVER') throw AppError.forbidden('A driver cannot cancel a trip; report it to the dispatcher');

  await transition(trip, 'cancel', user, req, {
    mutate: (t) => {
      t.cancellationReason = reason;
    },
    note: reason,
    audit: { metadata: { reason } },
    clientMessage: role === 'ADMIN' ? { title: 'Safari imesitishwa', message: reason, event: 'TRANSPORT_CANCELLED' } : null,
  });

  // A partner who was booked has to hear about it, or a car still comes.
  if (trip.partnerReference) {
    partners
      .active()
      .cancelTrip(trip, reason)
      .then((r) => {
        if (r.status !== 'OK') {
          return careEvents.toDesk({
            title: 'Sitisha safari kwa simu',
            message: `${trip.bookingReference}: mfumo wa kampuni ya usafiri haukupokea usitishaji (${r.status}). Wapigie.`,
            event: 'TRANSPORT_PARTNER_CANCEL_MANUAL',
            data: { transportId: trip.id },
          });
        }
        return null;
      })
      .catch((err) => logger.error('Partner cancel failed', { transportId: trip.id, message: err.message }));
  } else if (role === 'OWNER') {
    await careEvents.toDesk({
      title: 'Mteja amesitisha usafiri',
      message: `${trip.bookingReference}: ${reason}`,
      event: 'TRANSPORT_CANCELLED_BY_CLIENT',
      data: { transportId: trip.id },
    });
  }
  return viewFor(user, await findDetailed(id));
}

// --- Trip progress (dispatcher or the staff member driving) ---------------

const PROGRESS_MESSAGES = {
  enRoute: { title: 'Gari liko njiani', message: 'Gari linakuja kukuchukua.', event: 'TRANSPORT_EN_ROUTE' },
  arrivedPickup: { title: 'Gari limefika', message: 'Gari limefika mahali pa kukuchukua.', event: 'TRANSPORT_ARRIVED_PICKUP' },
  startTrip: null,
  arrivedDestination: { title: 'Mmefika', message: 'Mmefika mahali mlipokuwa mnaenda.', event: 'TRANSPORT_ARRIVED_DESTINATION' },
  complete: { title: 'Safari imekamilika', message: 'Asante kwa kutumia Afya Nyumbani.', event: 'TRANSPORT_COMPLETED' },
};

async function progress(user, id, action, req, { viaPartner = false, note = null } = {}) {
  if (!sm.PROGRESS_ACTIONS.includes(action)) throw AppError.badRequest('Unknown trip action');
  const trip = await load(id);
  if (!viaPartner) {
    const role = await assertAccess(user, trip, { driver: true });
    if (role === 'OWNER') throw AppError.forbidden('Only the driver or a dispatcher can update trip progress');
  }
  await transition(trip, action, viaPartner ? null : user, req, {
    note,
    clientMessage: PROGRESS_MESSAGES[action],
  });
  return viaPartner ? trip : viewFor(user, await findDetailed(id));
}

// A partner callback, already signature-checked. Applies the status it
// reports if that is a legal next step, ignores it (and says so) if not.
async function applyPartnerUpdate(update) {
  if (!update.partnerReference) return { applied: false, reason: 'NO_REFERENCE' };
  const trip = await TransportRequest.findOne({ where: { partnerReference: update.partnerReference } });
  if (!trip) return { applied: false, reason: 'UNKNOWN_TRIP' };

  if (update.driverName || update.vehicleDetails || update.driverPhone) {
    if (update.driverName) trip.driverName = update.driverName;
    if (update.driverPhone) trip.driverPhone = update.driverPhone;
    if (update.vehicleDetails) trip.vehicleDetails = update.vehicleDetails;
    await trip.save();
  }

  const action = sm.STATUS_TO_PROGRESS_ACTION[update.tripStatus];
  if (!action) return { applied: false, reason: 'UNMAPPED_STATUS', tripId: trip.id };
  if (!sm.ALLOWED_FROM[action].includes(trip.status)) {
    return { applied: false, reason: 'NOT_A_LEGAL_NEXT_STEP', tripId: trip.id, current: trip.status };
  }

  if (sm.PROGRESS_ACTIONS.includes(action)) {
    await progress(null, trip.id, action, null, { viaPartner: true, note: update.note || 'Kutoka kwa kampuni ya usafiri' });
  } else {
    const reason = update.note || (action === 'cancel' ? 'Imesitishwa na kampuni ya usafiri' : 'Imeshindikana kwa upande wa kampuni ya usafiri');
    await transition(trip, action, null, null, {
      mutate: (t) => {
        t.cancellationReason = reason;
      },
      note: reason,
      clientMessage: { title: 'Taarifa ya safari', message: reason, event: `TRANSPORT_${sm.TARGET_STATUS[action]}` },
    });
    await careEvents.toDesk({
      title: 'Kampuni ya usafiri imebadilisha safari',
      message: `${trip.bookingReference}: ${reason}`,
      event: 'TRANSPORT_PARTNER_CHANGED',
      data: { transportId: trip.id },
    });
  }
  return { applied: true, tripId: trip.id };
}

async function expireOverdue() {
  const graceMinutes = await settings.get('dispatch.expireAfterMinutes');
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const overdue = await TransportRequest.findAll({
    where: { status: { [Op.in]: sm.ALLOWED_FROM.expire }, scheduledAt: { [Op.lt]: cutoff } },
    limit: 200,
  });
  let expired = 0;
  for (const trip of overdue) {
    try {
      await transition(trip, 'expire', null, null, {
        note: 'Muda wa safari ulipita kabla haijapangwa',
        clientMessage: {
          title: 'Ombi la usafiri limepitwa na muda',
          message: 'Samahani, hatukuweza kupanga usafiri kwa muda uliochagua.',
          event: 'TRANSPORT_EXPIRED',
        },
      });
      expired += 1;
    } catch (err) {
      if (err.statusCode !== 409) throw err;
    }
  }
  return expired;
}

module.exports = {
  create,
  list,
  getOne,
  review,
  quote,
  reject,
  assign,
  fail,
  acceptQuote,
  declineQuote,
  cancel,
  progress,
  applyPartnerUpdate,
  expireOverdue,
  findDetailed,
  assertAccess,
  toClientView,
};
