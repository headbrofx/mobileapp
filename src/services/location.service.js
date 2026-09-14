'use strict';

const { Booking, BookingLocationPing } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { haversineKm, estimateEtaMinutes, proximityLabel, isStale } = require('../utils/geo');

const DISCLAIMER = 'Estimated straight-line distance/ETA from the last known position — not real-time traffic-aware routing.';

// Only recorded while the booking is actually on the way — once the
// staff member has arrived there's nothing left to track towards, and
// pings before assignment/acceptance would have nowhere meaningful to
// point at (no confirmed staff member yet).
async function recordPing(bookingId, data, actorUser, req) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  if (booking.status !== 'ON_THE_WAY') {
    throw AppError.conflict('Location can only be shared while the booking is on the way to the patient');
  }

  const ping = await BookingLocationPing.create({
    bookingId: booking.id,
    staffId: booking.staffId,
    lat: data.lat,
    lng: data.lng,
    recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
  });

  await logAudit({
    userId: actorUser.id,
    action: 'LOCATION_PING_RECORDED',
    req,
    entityType: 'Booking',
    entityId: booking.id,
    metadata: { pingId: ping.id },
  });

  return ping;
}

// "Where's my nurse right now" — the latest ping, plus a rough distance/
// ETA/proximity read against the booking's destination coordinates (when
// the booking has any — locationLat/Lng are optional on Booking) and a
// staleness flag so a stopped/lost connection doesn't look like they're
// still moving.
async function getCurrent(bookingId) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  const latestPing = await BookingLocationPing.findOne({
    where: { bookingId },
    order: [['recordedAt', 'DESC']],
  });

  if (!latestPing) {
    return {
      hasLocation: false,
      latestPing: null,
      distanceKm: null,
      etaMinutes: null,
      proximity: null,
      stale: null,
      disclaimer: DISCLAIMER,
    };
  }

  let distanceKm = null;
  let etaMinutes = null;
  let proximity = null;

  if (booking.locationLat != null && booking.locationLng != null) {
    distanceKm = haversineKm(latestPing.lat, latestPing.lng, booking.locationLat, booking.locationLng);
    etaMinutes = estimateEtaMinutes(distanceKm);
    proximity = proximityLabel(distanceKm);
    distanceKm = Math.round(distanceKm * 100) / 100;
  }

  return {
    hasLocation: true,
    latestPing: { lat: latestPing.lat, lng: latestPing.lng, recordedAt: latestPing.recordedAt },
    distanceKm,
    etaMinutes,
    proximity,
    stale: isStale(latestPing.recordedAt),
    disclaimer: DISCLAIMER,
  };
}

async function getHistory(bookingId, { limit = 100 } = {}) {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) throw AppError.notFound('Booking not found');

  return BookingLocationPing.findAll({
    where: { bookingId },
    order: [['recordedAt', 'ASC']],
    limit: Math.min(parseInt(limit, 10) || 100, 500),
  });
}

module.exports = { recordPing, getCurrent, getHistory };
