'use strict';

const { Op, fn, col } = require('sequelize');
const { Booking, TransportRequest, Staff, User, StatusHistory, sequelize } = require('../models');
const bookingService = require('./booking.service');
const transportService = require('./transport.service');
const { recommendForBooking } = require('./staffMatch.service');
const history = require('./statusHistory.service');
const availability = require('./staffAvailability.service');
const partners = require('../integrations/transport');
const location = require('../integrations/location');
const messaging = require('../integrations/messaging');
const payments = require('../integrations/payments');
const { DETAIL_INCLUDE } = require('../middleware/bookingAccess');

// The Dispatch Center: one queue of everything waiting on a person,
// recommendations with their reasons, and the integrations' state.
//
// Hybrid by design. The system ranks; a dispatcher decides. Choosing
// someone other than the top recommendation is allowed and asks for a
// reason, which is kept in the audit log and the request's history.

const NEEDS_ACTION = {
  booking: ['REQUESTED', 'UNDER_REVIEW', 'REJECTED', 'RESCHEDULED'],
  transport: ['REQUESTED', 'UNDER_REVIEW', 'ACCEPTED'],
};
const IN_FLIGHT = {
  booking: ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'],
  transport: ['QUOTED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION'],
};

async function queue({ view = 'needs_action', kind } = {}) {
  // The sweep runs first so nothing past its time shows as actionable.
  const [expiredBookings, expiredTrips] = await Promise.all([
    bookingService.expireOverdue(),
    transportService.expireOverdue(),
  ]);

  const statuses = view === 'in_flight' ? IN_FLIGHT : NEEDS_ACTION;

  const [bookings, trips] = await Promise.all([
    kind === 'TRANSPORT'
      ? []
      : Booking.findAll({
          where: { status: { [Op.in]: statuses.booking } },
          include: DETAIL_INCLUDE,
          order: [['scheduledAt', 'ASC']],
          limit: 200,
        }),
    kind === 'HOME_VISIT'
      ? []
      : transportService.list({ role: 'ADMIN' }, { limit: 200 }).then((all) => all.filter((t) => statuses.transport.includes(t.status))),
  ]);

  const items = [
    ...bookings.map((b) => ({
      kind: 'HOME_VISIT',
      id: b.id,
      reference: b.bookingReference,
      status: b.status,
      scheduledAt: b.scheduledAt,
      createdAt: b.createdAt,
      title: b.service ? b.service.name : null,
      patientName: b.patient ? b.patient.name : null,
      place: b.locationAddress,
      hasPin: b.locationLat != null && b.locationLng != null,
      staffName: b.staff && b.staff.user ? b.staff.user.name : null,
    })),
    ...trips.map((t) => ({
      kind: 'TRANSPORT',
      id: t.id,
      reference: t.bookingReference,
      status: t.status,
      scheduledAt: t.scheduledAt,
      createdAt: t.createdAt,
      title: t.destinationName,
      patientName: t.patient ? t.patient.name : null,
      place: t.pickupAddress,
      hasPin: t.pickupLat != null && t.pickupLng != null,
      staffName: t.driver && t.driver.user ? t.driver.user.name : t.driverName,
      fareTzs: t.confirmedFareTzs ?? t.quotedFareTzs,
    })),
  ].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  return { view, items, swept: { bookings: expiredBookings, transport: expiredTrips } };
}

async function bookingDetail(id) {
  const booking = await bookingService.findDetailed(id);
  const [recommendations, timeline] = await Promise.all([
    recommendForBooking(booking),
    history.timeline('BOOKING', id),
  ]);
  return { booking, recommendations, timeline };
}

// Assign from the Dispatch Center: the same server-side checks as
// anywhere else, plus a required reason when overriding.
async function assignBooking(id, { staffId, overrideReason }, actor, req) {
  return bookingService.assign(id, staffId, actor, req, { overrideReason, requireReasonForOverride: true });
}

// Staff who could drive a trip at that time, for the transport assign
// form. Ranked plainly: free at that time first, then available now.
async function transportDrivers(id) {
  const trip = await transportService.findDetailed(id);
  const staff = await Staff.findAll({
    where: { approvalStatus: 'APPROVED' },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'status'] }],
    limit: 200,
  });
  const conflictsByStaff = await availability.findConflictsForMany(
    staff.map((s) => s.id),
    trip.scheduledAt,
    { excludeTransportId: trip.id }
  );
  const rows = [];
  for (const s of staff) {
    if (s.user && s.user.status === 'SUSPENDED') continue;
    const conflicts = conflictsByStaff[s.id] || [];
    const away = availability.isMarkedAway(s, trip.scheduledAt);
    rows.push({
      id: s.id,
      name: s.user ? s.user.name : null,
      phone: s.user ? s.user.phone : null,
      specialty: s.specialty,
      availability: s.availability,
      eligible: !away && conflicts.length === 0,
      blockers: [...(away ? ['Amejiweka hayupo'] : []), ...(conflicts.length ? [`Tayari ana ${conflicts.map((c) => c.reference).join(', ')}`] : [])],
    });
  }
  rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || Number(b.availability === 'AVAILABLE') - Number(a.availability === 'AVAILABLE'));
  return { trip, drivers: rows, partner: partners.describe() };
}

function integrations() {
  return {
    transportPartner: partners.describe(),
    maps: location.describe(),
    messaging: messaging.describe(),
    payments: payments.describe(),
  };
}

// --- Analytics, from the rows themselves ----------------------------------

async function analytics({ days = 30 } = {}) {
  const since = new Date(Date.now() - Math.min(Math.max(parseInt(days, 10) || 30, 1), 365) * 24 * 3600 * 1000);

  const [bookingByStatus, tripByStatus] = await Promise.all([
    Booking.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
    TransportRequest.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    }),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  const bookings = toMap(bookingByStatus);
  const trips = toMap(tripByStatus);
  const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);

  // Median minutes from request to first assignment, from the history
  // table. Only requests created since history began are counted, and
  // the figure says how many it is based on.
  const [assignRows] = await sequelize.query(
    `SELECT EXTRACT(EPOCH FROM (a.created_at - r.created_at)) / 60 AS minutes
       FROM status_history r
       JOIN LATERAL (
         SELECT created_at FROM status_history a
          WHERE a.entity_type = r.entity_type AND a.entity_id = r.entity_id AND a.to_status = 'ASSIGNED'
          ORDER BY created_at ASC LIMIT 1
       ) a ON true
      WHERE r.entity_type = 'BOOKING' AND r.from_status IS NULL AND r.created_at >= :since`,
    { replacements: { since } }
  );
  const mins = assignRows.map((r) => Number(r.minutes)).sort((a, b) => a - b);
  const median = mins.length ? Math.round(mins[Math.floor(mins.length / 2)]) : null;

  const overrides = await sequelize.query(
    `SELECT COUNT(*) FILTER (WHERE (metadata->>'followedRecommendation')::boolean IS FALSE) AS overridden,
            COUNT(*) AS total
       FROM audit_logs WHERE action = 'BOOKING_ASSIGNED' AND created_at >= :since`,
    { replacements: { since }, type: sequelize.QueryTypes.SELECT }
  );

  return {
    since,
    homeVisits: {
      total: total(bookings),
      byStatus: bookings,
      completionRate: total(bookings) ? Math.round(((bookings.COMPLETED || 0) / total(bookings)) * 100) : null,
      cancellationRate: total(bookings) ? Math.round(((bookings.CANCELLED || 0) / total(bookings)) * 100) : null,
      medianMinutesToAssign: median,
      medianBasedOn: mins.length,
    },
    transport: {
      total: total(trips),
      byStatus: trips,
    },
    dispatch: {
      assignments: Number(overrides[0]?.total || 0),
      overrodeRecommendation: Number(overrides[0]?.overridden || 0),
    },
    staffOnDutyNow: await Staff.count({ where: { approvalStatus: 'APPROVED', availability: 'AVAILABLE' } }),
    historyRows: await StatusHistory.count({ where: { createdAt: { [Op.gte]: since } } }),
  };
}

module.exports = { queue, bookingDetail, assignBooking, transportDrivers, integrations, analytics, NEEDS_ACTION, IN_FLIGHT };
