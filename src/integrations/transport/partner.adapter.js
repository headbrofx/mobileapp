'use strict';

// ─────────────────────────────────────────────────────────────────────
//  TRANSPORT COMPANY ADAPTER — LEFT BLANK ON PURPOSE
//
//  Kampuni ya usafiri ikishasainiwa, jaza sehemu zilizoandikwa
//  "TODO(partner)" hapa chini kulingana na API yao. Hakuna kingine
//  kwenye mfumo kinachohitaji kubadilishwa.
//
//  Fill in the TODO(partner) parts below against the company's API
//  documentation. Nothing else in the system needs to change: the
//  transport service, the Dispatch Center and the webhook route already
//  call these functions and already handle every status they can return.
//
//  Until a function is filled in it returns NOT_IMPLEMENTED, which the
//  dispatcher sees as "do this one by hand". It never pretends.
// ─────────────────────────────────────────────────────────────────────

const logger = require('../../config/logger');

const TIMEOUT_MS = 10000;

function config() {
  return {
    name: process.env.TRANSPORT_PARTNER_NAME || null,
    baseUrl: process.env.TRANSPORT_PARTNER_BASE_URL || null,
    apiKey: process.env.TRANSPORT_PARTNER_API_KEY || null,
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.baseUrl && c.apiKey);
}

const NOT_CONFIGURED = Object.freeze({ status: 'NOT_CONFIGURED' });
const NOT_IMPLEMENTED = Object.freeze({ status: 'NOT_IMPLEMENTED' });

// A thin HTTP helper, ready for the functions below. Auth is sent as a
// bearer token; change it here if the partner wants a different header.
async function call(method, path, body) {
  const { baseUrl, apiKey } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`, // TODO(partner): their auth scheme
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    logger.error('Transport partner call failed', { path, message: err.message });
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

// What we send them about a trip. Only what a driver needs: where,
// where to, when, how many, and what help the passenger needs. No
// diagnosis, no health record. The contact phone is the one the client
// typed for this trip.
function tripPayload(trip) {
  return {
    externalReference: trip.bookingReference,
    pickup: { address: trip.pickupAddress, lat: trip.pickupLat, lng: trip.pickupLng },
    dropoff: { name: trip.destinationName, address: trip.destinationAddress, lat: trip.destinationLat, lng: trip.destinationLng },
    scheduledAt: trip.scheduledAt,
    passengers: trip.passengerCount,
    assistance: trip.mobilityNeeds || null,
    contactPhone: trip.contactPhone,
  };
}

// Ask for a price.
// Must return { status: 'OK', fareTzs: <integer TZS>, note? } only when
// the partner actually answered with a price.
async function requestQuote(trip) {
  if (!isConfigured()) return NOT_CONFIGURED;
  // TODO(partner): e.g.
  //   const res = await call('POST', '/quotes', tripPayload(trip));
  //   if (!res.ok) return { status: 'FAILED', raw: res.json };
  //   return { status: 'OK', fareTzs: Math.round(res.json.amount), note: res.json.note, raw: res.json };
  void trip;
  void tripPayload;
  return NOT_IMPLEMENTED;
}

// Book the vehicle after the client has accepted the fare.
// Must return { status: 'OK', partnerReference, driverName?, driverPhone?, vehicleDetails? }.
async function bookTrip(trip) {
  if (!isConfigured()) return NOT_CONFIGURED;
  // TODO(partner): e.g.
  //   const res = await call('POST', '/trips', { ...tripPayload(trip), fare: trip.confirmedFareTzs });
  //   if (!res.ok) return { status: 'FAILED', raw: res.json };
  //   return {
  //     status: 'OK',
  //     partnerReference: res.json.id,
  //     driverName: res.json.driver?.name,
  //     driverPhone: res.json.driver?.phone,
  //     vehicleDetails: [res.json.vehicle?.model, res.json.vehicle?.plate].filter(Boolean).join(' · '),
  //     raw: res.json,
  //   };
  void trip;
  return NOT_IMPLEMENTED;
}

async function cancelTrip(trip, reason) {
  if (!isConfigured()) return NOT_CONFIGURED;
  if (!trip.partnerReference) return NOT_IMPLEMENTED;
  // TODO(partner): e.g.
  //   const res = await call('POST', `/trips/${encodeURIComponent(trip.partnerReference)}/cancel`, { reason });
  //   return { status: res.ok ? 'OK' : 'FAILED', raw: res.json };
  void reason;
  return NOT_IMPLEMENTED;
}

async function getTripStatus(trip) {
  if (!isConfigured()) return NOT_CONFIGURED;
  if (!trip.partnerReference) return NOT_IMPLEMENTED;
  // TODO(partner): e.g.
  //   const res = await call('GET', `/trips/${encodeURIComponent(trip.partnerReference)}`);
  //   if (!res.ok) return { status: 'FAILED', raw: res.json };
  //   return { status: 'OK', tripStatus: mapStatus(res.json.status), raw: res.json };
  return NOT_IMPLEMENTED;
}

// Their status words -> ours. Anything unknown maps to null and is
// ignored (and logged) rather than guessed at.
// TODO(partner): fill in from their documentation.
const STATUS_MAP = {
  // driver_assigned: 'ASSIGNED',
  // driver_en_route: 'EN_ROUTE',
  // driver_arrived: 'ARRIVED_PICKUP',
  // on_trip: 'IN_TRIP',
  // dropped_off: 'ARRIVED_DESTINATION',
  // completed: 'COMPLETED',
  // cancelled: 'CANCELLED',
  // failed: 'FAILED',
};

function mapStatus(theirs) {
  return STATUS_MAP[String(theirs || '').toLowerCase()] || null;
}

// Turn their callback body into ours. The signature has already been
// checked by the time this runs.
// TODO(partner): adjust the field names to their payload.
function parseWebhook(body) {
  return {
    partnerReference: body?.tripId ?? body?.id ?? null,
    tripStatus: mapStatus(body?.status),
    driverName: body?.driver?.name ?? null,
    driverPhone: body?.driver?.phone ?? null,
    vehicleDetails: body?.vehicle ? [body.vehicle.model, body.vehicle.plate].filter(Boolean).join(' · ') : null,
    note: body?.note ?? null,
  };
}

module.exports = {
  isConfigured,
  name: () => config().name,
  requestQuote,
  bookTrip,
  cancelTrip,
  getTripStatus,
  parseWebhook,
  // Exported for tests and for whoever fills this in.
  _internal: { call, tripPayload, mapStatus, STATUS_MAP },
};
