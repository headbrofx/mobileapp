'use strict';

const care = require('../services/care.service');
const transport = require('../services/transport.service');
const dispatch = require('../services/dispatch.service');
const settings = require('../services/settings.service');
const zones = require('../services/zone.service');
const staffService = require('../services/staff.service');
const { success } = require('../utils/apiResponse');

// Care Mobility controllers: client, staff and dispatcher sides. Each
// is a thin wrapper; access rules live in the routes and services.
function handle(message, fn, statusCode = 200) {
  return async (req, res, next) => {
    try {
      const data = await fn(req, res);
      return success(res, { statusCode, message, data });
    } catch (err) {
      next(err);
    }
  };
}

function num(v) {
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? undefined : n;
}

function idempotencyKey(req) {
  return req.get('Idempotency-Key') || req.body.idempotencyKey || null;
}

module.exports = {
  // --- Client ---
  discover: handle('Care near you', (req) => care.discover({ lat: num(req.query.lat), lng: num(req.query.lng) })),
  myRequests: handle('My care requests', (req) =>
    care.myRequests(req.user, { tab: req.query.tab || 'upcoming', familyMemberId: req.query.familyMemberId })
  ),
  track: handle('Tracking', (req) => care.track(req.user, req.params.kind.toUpperCase().replace('-', '_'), req.params.id)),

  listLocations: handle('Saved places', async (req) => ({ locations: await care.listLocations(req.user) })),
  createLocation: handle('Saved place added', async (req) => ({ location: await care.createLocation(req.user, req.body) }), 201),
  updateLocation: handle('Saved place updated', async (req) => ({ location: await care.updateLocation(req.user, req.params.id, req.body) })),
  deleteLocation: handle('Saved place removed', async (req) => {
    await care.deleteLocation(req.user, req.params.id, req);
    return null;
  }),

  // --- Transport (client + driver) ---
  createTransport: async (req, res, next) => {
    try {
      const { trip, replayed } = await transport.create(req.user, req.body, { idempotencyKey: idempotencyKey(req) });
      return success(res, {
        statusCode: replayed ? 200 : 201,
        message: replayed ? 'Transport already requested' : 'Transport requested',
        data: { trip, replayed },
      });
    } catch (err) {
      next(err);
    }
  },
  listTransport: handle('Transport requests', async (req) => ({ trips: await transport.list(req.user, req.query) })),
  getTransport: handle('Transport request', async (req) => ({ trip: await transport.getOne(req.user, req.params.id) })),
  acceptQuote: handle('Quote accepted', async (req) => ({ trip: await transport.acceptQuote(req.user, req.params.id, req) })),
  declineQuote: handle('Quote declined', async (req) => ({
    trip: await transport.declineQuote(req.user, req.params.id, req.body.reason, req),
  })),
  cancelTransport: handle('Transport cancelled', async (req) => ({
    trip: await transport.cancel(req.user, req.params.id, req.body.reason, req),
  })),
  progressTransport: handle('Trip updated', async (req) => ({
    trip: await transport.progress(req.user, req.params.id, req.body.action, req, { note: req.body.note }),
  })),

  // --- Staff ---
  updateMyAvailability: handle('Availability updated', async (req) => ({
    staff: await staffService.updateMyAvailability(req.user.id, req.body, req),
  })),

  // --- Dispatcher ---
  queue: handle('Dispatch queue', (req) => dispatch.queue({ view: req.query.view, kind: req.query.kind })),
  bookingDetail: handle('Dispatch booking', (req) => dispatch.bookingDetail(req.params.id)),
  assignBooking: handle('Booking assigned', async (req) => ({
    booking: await dispatch.assignBooking(req.params.id, req.body, req.user, req),
  })),
  transportDetail: handle('Dispatch trip', async (req) => {
    const { trip, drivers, partner } = await dispatch.transportDrivers(req.params.id);
    const timeline = await require('../services/statusHistory.service').timeline('TRANSPORT', req.params.id);
    return { trip, drivers, partner, timeline };
  }),
  reviewTransport: handle('Under review', async (req) => ({ trip: await transport.review(req.params.id, req.user, req) })),
  quoteTransport: handle('Quote sent', async (req) => ({ trip: await transport.quote(req.params.id, req.body, req.user, req) })),
  rejectTransport: handle('Transport rejected', async (req) => ({
    trip: await transport.reject(req.params.id, req.body.reason, req.user, req),
  })),
  assignTransport: handle('Transport assigned', async (req) => ({
    trip: await transport.assign(req.params.id, req.body, req.user, req),
  })),
  failTransport: handle('Transport marked failed', async (req) => ({
    trip: await transport.fail(req.params.id, req.body.reason, req.user, req),
  })),
  integrations: handle('Integrations', () => dispatch.integrations()),
  analytics: handle('Dispatch analytics', (req) => dispatch.analytics({ days: req.query.days })),

  getSettings: handle('Settings', async () => ({ settings: await settings.getAll() })),
  updateSettings: handle('Settings updated', async (req) => ({ settings: await settings.update(req.body, req.user, req) })),
  listZones: handle('Service zones', async () => ({ zones: await zones.listAll() })),
  createZone: handle('Zone created', async (req) => ({ zone: await zones.create(req.body, req.user, req) }), 201),
  updateZone: handle('Zone updated', async (req) => ({ zone: await zones.update(req.params.id, req.body, req.user, req) })),
};
