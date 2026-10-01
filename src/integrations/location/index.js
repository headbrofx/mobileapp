'use strict';

// Maps, geocoding and routing.
//
// The app works without any of them. A client types an address and may
// drop a pin from their phone's GPS; distances are straight lines
// (haversine) and are labelled that way. What is NOT done without a
// routing provider is an arrival time: a straight line through Dar es
// Salaam traffic is not a drive time, and a made-up "12 min" that turns
// into forty is worse than no number.
//
// To connect a provider, set LOCATION_PROVIDER and its key in the
// host's environment and fill in the matching functions below:
//
//   LOCATION_PROVIDER=google   GOOGLE_MAPS_API_KEY=...
//   LOCATION_PROVIDER=mapbox   MAPBOX_ACCESS_TOKEN=...
//
// Every function returns { status: 'OK', ... } only with a real answer
// from the provider; otherwise NOT_CONFIGURED / NOT_IMPLEMENTED / FAILED.

const { haversineKm } = require('../../utils/geo');

const PROVIDERS = {
  google: { keyEnv: 'GOOGLE_MAPS_API_KEY' },
  mapbox: { keyEnv: 'MAPBOX_ACCESS_TOKEN' },
};

function provider() {
  const name = (process.env.LOCATION_PROVIDER || '').toLowerCase();
  const def = PROVIDERS[name];
  if (!def || !process.env[def.keyEnv]) return null;
  return name;
}

function describe() {
  return {
    provider: provider(),
    geocoding: false, // flips to true per function as each is implemented
    routing: false,
    distance: 'STRAIGHT_LINE',
  };
}

const NOT_CONFIGURED = Object.freeze({ status: 'NOT_CONFIGURED' });
const NOT_IMPLEMENTED = Object.freeze({ status: 'NOT_IMPLEMENTED' });

// Address text -> { lat, lng, formatted }.
async function geocode(address) {
  if (!provider()) return NOT_CONFIGURED;
  // TODO(maps): call the provider's geocoding endpoint.
  void address;
  return NOT_IMPLEMENTED;
}

// { lat, lng } -> { formatted, area }.
async function reverseGeocode(lat, lng) {
  if (!provider()) return NOT_CONFIGURED;
  // TODO(maps): call the provider's reverse geocoding endpoint.
  void lat;
  void lng;
  return NOT_IMPLEMENTED;
}

// Two points -> { distanceKm, durationMinutes } by road, with traffic
// where the provider supports it. This is the only source of an ETA.
async function route(from, to) {
  if (!provider()) return NOT_CONFIGURED;
  // TODO(maps): call the provider's directions/matrix endpoint.
  void from;
  void to;
  return NOT_IMPLEMENTED;
}

// Always available: a straight-line distance, rounded, labelled.
function straightLineKm(a, b) {
  if ([a?.lat, a?.lng, b?.lat, b?.lng].some((v) => v == null)) return null;
  return Math.round(haversineKm(a.lat, a.lng, b.lat, b.lng) * 10) / 10;
}

// For discovery: a location precise enough to say which zone someone is
// in and roughly how far care is, and no more. Two decimal places is
// about a kilometre; nothing finer is kept or logged.
function approximate(lat, lng) {
  if (lat == null || lng == null) return null;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

module.exports = { describe, geocode, reverseGeocode, route, straightLineKm, approximate };
