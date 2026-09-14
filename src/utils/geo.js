'use strict';

// Straight-line (great-circle) distance in kilometers — no routing API,
// no budget for one yet. Good enough for "roughly how far / roughly how
// long", explicitly documented as an estimate everywhere it's surfaced.
const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Assumed average urban travel speed for Dar es Salaam traffic — a rule
// of thumb, not a traffic-aware routing estimate.
const ASSUMED_SPEED_KMH = 25;
const ARRIVING_SOON_KM = 0.3; // ~ a few minutes' walk from the door
const STALE_AFTER_MINUTES = 10;

function estimateEtaMinutes(distanceKm) {
  return Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60));
}

function proximityLabel(distanceKm) {
  return distanceKm <= ARRIVING_SOON_KM ? 'ARRIVING_SOON' : 'EN_ROUTE';
}

function isStale(recordedAt, now = new Date()) {
  return now.getTime() - new Date(recordedAt).getTime() > STALE_AFTER_MINUTES * 60 * 1000;
}

module.exports = { haversineKm, estimateEtaMinutes, proximityLabel, isStale, STALE_AFTER_MINUTES };
