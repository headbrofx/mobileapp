'use strict';

// Transport partner integration — the seam where a transport company
// plugs in.
//
// Today no company is signed, so the active adapter is `none`: every
// call answers NOT_CONFIGURED and the dispatcher does the work by hand
// (phones a driver, types the driver's name and vehicle into the
// Dispatch Center). Nothing in the transport flow depends on a partner
// existing.
//
// When a company is signed:
//
//   1. Fill in partner.adapter.js: the five functions below, mapped to
//      their API. Each one says what it receives and must return.
//   2. Set, in the host's environment (never in the repository):
//        TRANSPORT_PARTNER=partner
//        TRANSPORT_PARTNER_NAME=<their name, shown to the dispatcher>
//        TRANSPORT_PARTNER_BASE_URL=<their API root>
//        TRANSPORT_PARTNER_API_KEY=<the key they issue>
//        TRANSPORT_WEBHOOK_SECRET=<shared secret for their callbacks>
//   3. Give them the callback URL:
//        POST https://<api-host>/api/integrations/transport/webhook
//      signed with HMAC-SHA256 of the raw body under the secret, hex, in
//      the X-Signature header. See transportWebhook.controller.js.
//
// The interface every adapter implements:
//
//   isConfigured()                         -> boolean
//   name()                                 -> string | null
//   requestQuote(trip)                     -> { status, fareTzs?, note?, raw? }
//   bookTrip(trip)                         -> { status, partnerReference?, driverName?, driverPhone?, vehicleDetails?, raw? }
//   cancelTrip(trip, reason)               -> { status, raw? }
//   getTripStatus(trip)                    -> { status, tripStatus?, raw? }
//   parseWebhook(body)                     -> { partnerReference, tripStatus, driverName?, driverPhone?, vehicleDetails?, note? }
//
// `status` is one of OK, NOT_CONFIGURED, NOT_IMPLEMENTED, FAILED.
// `tripStatus` is OUR status vocabulary (EN_ROUTE, ARRIVED_PICKUP,
// IN_TRIP, ARRIVED_DESTINATION, COMPLETED, CANCELLED, FAILED): the
// adapter translates theirs, so nothing outside this folder ever needs
// to know what a partner calls things.
//
// No adapter may ever report OK for something that did not happen. A
// quote that was not returned is NOT_IMPLEMENTED or FAILED, never a
// made-up fare.

const noneAdapter = require('./none.adapter');
const partnerAdapter = require('./partner.adapter');

const ADAPTERS = {
  none: noneAdapter,
  partner: partnerAdapter,
};

function active() {
  const key = (process.env.TRANSPORT_PARTNER || 'none').toLowerCase();
  return ADAPTERS[key] || noneAdapter;
}

// What the dispatcher's screen says about the integration.
function describe() {
  const adapter = active();
  return {
    adapter: adapter === noneAdapter ? 'none' : 'partner',
    name: adapter.name(),
    configured: adapter.isConfigured(),
    webhookConfigured: Boolean(process.env.TRANSPORT_WEBHOOK_SECRET),
  };
}

module.exports = { active, describe, ADAPTERS };
