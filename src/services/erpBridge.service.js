'use strict';

const logger = require('../config/logger');
const { logAudit } = require('./audit.service');

// Sending an order to Afya Nyumbani's own management software.
//
// The ERP lives in its own repository (joeroberty01-blip/ansoftware), a
// Next.js app over Postgres, and it already has a bookings table and a
// bookings page. What it does not have is a way for another machine to
// put something in it: POST /api/bookings calls getCurrentUser(), which
// reads a session cookie, so only a signed-in admin in a browser can
// create one. It also stores created_by_id NOT NULL against its users
// table, and an integration is not a user.
//
// So this half is written against the shape the ERP already validates
// (fullName, phone, serviceType, preferredDate, notes — see its
// src/lib/validation/bookings.ts), and points at a URL and a key from
// the environment. The other half — an endpoint that accepts a key
// instead of a cookie — has to be added there.
//
// Until both env vars are set this does nothing at all, quietly. That
// is deliberate: the bridge shipping before its far end exists must not
// change what happens to a booking today.

const URL_KEY = 'ERP_BOOKINGS_URL';
const KEY_KEY = 'ERP_API_KEY';

const TIMEOUT_MS = 10000;
const ATTEMPTS = 3;

function configured() {
  return Boolean(process.env[URL_KEY] && process.env[KEY_KEY]);
}

// The ERP keeps a date, not a datetime, and has no column for an
// address. Both of those matter to a nurse who has to arrive somewhere
// at a particular hour, so the time and the address go into notes,
// which the ERP does keep and does show. It is a lossy join and it is
// written down rather than hidden: when the ERP grows the columns, this
// is the function to change.
function toErpBooking({ booking, service, familyMember, client }) {
  const scheduled = new Date(booking.scheduledAt);

  const time = scheduled.toLocaleTimeString('sw-TZ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    `Saa: ${time}`,
    `Mahali: ${booking.locationAddress}`,
    booking.locationLat && booking.locationLng
      ? `Ramani: ${booking.locationLat},${booking.locationLng}`
      : null,
    client?.name && client.name !== familyMember.name ? `Ameagiza: ${client.name}` : null,
    booking.notes ? `Maelezo: ${booking.notes}` : null,
    `Kumbukumbu ya app: ${booking.id}`,
  ].filter(Boolean);

  return {
    // The patient, not the account holder — the ERP turns a booking
    // into a patient record, and the record has to be about the person
    // being cared for. Who placed it is in the notes above.
    fullName: familyMember.name,
    // The account's number, because that is the one that answers.
    phone: client?.phone ?? '',
    serviceType: service.name,
    preferredDate: scheduled.toISOString().slice(0, 10),
    notes: lines.join('\n').slice(0, 1000),
  };
}

async function post(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(process.env[URL_KEY], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // A shared secret, not a user session. The far end has to
        // compare this in constant time and do nothing else with it.
        'X-Api-Key': process.env[KEY_KEY],
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

// Never throws, never blocks a booking.
//
// A client who asked for a nurse has done their part; whether our
// office software accepted the message is our problem, not theirs. So
// a failure here is logged and audited loudly and the booking stands.
// The audit trail is the point — an order the ERP never received is
// invisible otherwise, and "it worked when I tried it" is not a way to
// run a business.
async function sendBooking(context) {
  if (!configured()) return { sent: false, reason: 'NOT_CONFIGURED' };

  const payload = toErpBooking(context);
  let last = null;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const result = await post(payload);
      if (result.ok) {
        await logAudit({
          action: 'ERP_BOOKING_SENT',
          entityType: 'Booking',
          entityId: context.booking.id,
          metadata: { attempt, status: result.status },
        });
        return { sent: true, attempt };
      }
      last = `HTTP ${result.status}: ${result.body}`;

      // A rejected payload will be rejected identically next time.
      // Only a server-side or transport failure is worth repeating.
      if (result.status >= 400 && result.status < 500) break;
    } catch (err) {
      last = err.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : err.message;
    }

    if (attempt < ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }

  logger.error('Booking did not reach the ERP', {
    bookingId: context.booking.id,
    reason: last,
  });

  await logAudit({
    action: 'ERP_BOOKING_FAILED',
    entityType: 'Booking',
    entityId: context.booking.id,
    metadata: { reason: last },
  });

  return { sent: false, reason: last };
}

module.exports = { sendBooking, toErpBooking, configured };
