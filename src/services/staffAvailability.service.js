'use strict';

const { Op } = require('sequelize');
const { Booking, TransportRequest } = require('../models');
const settings = require('./settings.service');

// Whether a given person can take a given slot, decided on the server.
//
// Three separate questions, because the dispatcher needs to see which
// one failed:
//
//   conflicts     another open visit or trip already overlaps the slot
//   unavailable   they have marked themselves away until after it
//   workingHours  the slot is outside the hours they said they work
//
// The first two block an assignment outright. The third is a warning:
// a nurse who said "until five" may well take a 17:30 visit if asked,
// and that is a conversation, not a rule.

// Statuses in which a visit or trip still occupies its person's time.
const OPEN_BOOKING = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];
const OPEN_TRIP = ['ASSIGNED', 'EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION'];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// Tanzania has one time zone and no daylight saving, so a fixed offset
// is exact rather than an approximation. A second country with a
// different zone would make this a per-zone setting.
const LOCAL_OFFSET_MINUTES = 180;

async function windowMinutes() {
  const [duration, buffer] = await Promise.all([
    settings.get('dispatch.visitDurationMinutes'),
    settings.get('dispatch.travelBufferMinutes'),
  ]);
  return duration + buffer;
}

// Every open visit and trip for this staff member that overlaps a slot
// starting at `at`. Each one occupies [start, start + window), so two
// slots clash when their starts are less than one window apart.
async function findConflicts(staffId, at, { excludeBookingId = null, excludeTransportId = null } = {}) {
  const span = (await windowMinutes()) * 60 * 1000;
  const from = new Date(new Date(at).getTime() - span + 1);
  const to = new Date(new Date(at).getTime() + span - 1);

  const bookingWhere = {
    staffId,
    status: { [Op.in]: OPEN_BOOKING },
    scheduledAt: { [Op.between]: [from, to] },
  };
  if (excludeBookingId) bookingWhere.id = { [Op.ne]: excludeBookingId };

  const tripWhere = {
    assignedStaffId: staffId,
    status: { [Op.in]: OPEN_TRIP },
    scheduledAt: { [Op.between]: [from, to] },
  };
  if (excludeTransportId) tripWhere.id = { [Op.ne]: excludeTransportId };

  const [bookings, trips] = await Promise.all([
    Booking.findAll({ where: bookingWhere, attributes: ['id', 'bookingReference', 'scheduledAt', 'status'] }),
    TransportRequest.findAll({ where: tripWhere, attributes: ['id', 'bookingReference', 'scheduledAt', 'status'] }),
  ]);

  return [
    ...bookings.map((b) => ({ kind: 'BOOKING', id: b.id, reference: b.bookingReference, scheduledAt: b.scheduledAt })),
    ...trips.map((t) => ({ kind: 'TRANSPORT', id: t.id, reference: t.bookingReference, scheduledAt: t.scheduledAt })),
  ];
}

// The same question for many people at once, in two queries rather
// than two per person: the dispatcher's shortlist asks it for everyone.
// Returns { staffId: [conflict, ...] }.
async function findConflictsForMany(staffIds, at, { excludeBookingId = null, excludeTransportId = null } = {}) {
  const result = {};
  if (!staffIds.length) return result;
  const span = (await windowMinutes()) * 60 * 1000;
  const from = new Date(new Date(at).getTime() - span + 1);
  const to = new Date(new Date(at).getTime() + span - 1);

  const bookingWhere = { staffId: { [Op.in]: staffIds }, status: { [Op.in]: OPEN_BOOKING }, scheduledAt: { [Op.between]: [from, to] } };
  if (excludeBookingId) bookingWhere.id = { [Op.ne]: excludeBookingId };
  const tripWhere = { assignedStaffId: { [Op.in]: staffIds }, status: { [Op.in]: OPEN_TRIP }, scheduledAt: { [Op.between]: [from, to] } };
  if (excludeTransportId) tripWhere.id = { [Op.ne]: excludeTransportId };

  const [bookings, trips] = await Promise.all([
    Booking.findAll({ where: bookingWhere, attributes: ['id', 'staffId', 'bookingReference', 'scheduledAt'] }),
    TransportRequest.findAll({ where: tripWhere, attributes: ['id', 'assignedStaffId', 'bookingReference', 'scheduledAt'] }),
  ]);
  bookings.forEach((b) => {
    (result[b.staffId] = result[b.staffId] || []).push({ kind: 'BOOKING', id: b.id, reference: b.bookingReference, scheduledAt: b.scheduledAt });
  });
  trips.forEach((t) => {
    (result[t.assignedStaffId] = result[t.assignedStaffId] || []).push({ kind: 'TRANSPORT', id: t.id, reference: t.bookingReference, scheduledAt: t.scheduledAt });
  });
  return result;
}

function isMarkedAway(staff, at) {
  return Boolean(staff.unavailableUntil && new Date(staff.unavailableUntil) > new Date(at));
}

function localParts(at) {
  const local = new Date(new Date(at).getTime() + LOCAL_OFFSET_MINUTES * 60 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return { day: DAY_KEYS[local.getUTCDay()], time: `${hh}:${mm}` };
}

// 'WITHIN' | 'OUTSIDE' | 'UNKNOWN'. UNKNOWN when they never said:
// treating silence as "always available" would quietly book people at
// 3 a.m.
function workingHoursFit(staff, at) {
  const hours = staff.workingHours;
  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) return 'UNKNOWN';
  const { day, time } = localParts(at);
  const ranges = Array.isArray(hours[day]) ? hours[day] : [];
  return ranges.some((r) => r && r.from <= time && time < r.to) ? 'WITHIN' : 'OUTSIDE';
}

module.exports = {
  OPEN_BOOKING,
  OPEN_TRIP,
  DAY_KEYS,
  findConflicts,
  findConflictsForMany,
  isMarkedAway,
  workingHoursFit,
  localParts,
  windowMinutes,
};
