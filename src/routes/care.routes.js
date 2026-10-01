'use strict';

const { Router } = require('express');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const v = require('../validators/care.validator');
const c = require('../controllers/care.controller');

// --- /api/care: discovery, My Care Requests, tracking, saved places ---
const care = Router();
care.use(authenticate);

care.get('/discover', c.discover);
care.get('/requests', requireRole('CLIENT'), c.myRequests);
// kind: home-visit | transport. Access is checked per item inside.
care.get('/requests/:kind/:id', c.track);

care.get('/locations', requireRole('CLIENT'), c.listLocations);
care.post('/locations', requireRole('CLIENT'), validate(v.savedLocationSchema), c.createLocation);
care.patch('/locations/:id', requireRole('CLIENT'), validate(v.updateSavedLocationSchema), c.updateLocation);
care.delete('/locations/:id', requireRole('CLIENT'), c.deleteLocation);

care.patch('/staff/availability', requireRole('STAFF'), validate(v.staffAvailabilitySchema), c.updateMyAvailability);

// --- /api/transport: Take Me to Care ---
const transport = Router();
transport.use(authenticate);

transport.post('/', requireRole('CLIENT'), validate(v.createTransportSchema), c.createTransport);
transport.get('/', c.listTransport); // role-scoped inside
transport.get('/:id', c.getTransport); // owner, driver or admin
transport.patch('/:id/accept-quote', requireRole('CLIENT', 'ADMIN'), c.acceptQuote);
transport.patch('/:id/decline-quote', requireRole('CLIENT', 'ADMIN'), validate(v.reasonOptionalSchema), c.declineQuote);
transport.patch('/:id/cancel', requireRole('CLIENT', 'ADMIN'), validate(v.reasonRequiredSchema), c.cancelTransport);
transport.patch('/:id/progress', requireRole('STAFF', 'ADMIN'), validate(v.progressSchema), c.progressTransport);

// --- /api/dispatch: the Dispatch Center (ADMIN only) ---
const dispatch = Router();
dispatch.use(authenticate, requireRole('ADMIN'));

dispatch.get('/queue', c.queue);
dispatch.get('/integrations', c.integrations);
dispatch.get('/analytics', c.analytics);

dispatch.get('/bookings/:id', c.bookingDetail);
dispatch.post('/bookings/:id/assign', validate(v.dispatchAssignSchema), c.assignBooking);

dispatch.get('/transport/:id', c.transportDetail);
dispatch.patch('/transport/:id/review', c.reviewTransport);
dispatch.patch('/transport/:id/quote', validate(v.quoteSchema), c.quoteTransport);
dispatch.patch('/transport/:id/reject', validate(v.reasonRequiredSchema), c.rejectTransport);
dispatch.patch('/transport/:id/assign', validate(v.assignTransportSchema), c.assignTransport);
dispatch.patch('/transport/:id/fail', validate(v.reasonRequiredSchema), c.failTransport);

dispatch.get('/settings', c.getSettings);
dispatch.patch('/settings', validate(v.settingsSchema), c.updateSettings);
dispatch.get('/zones', c.listZones);
dispatch.post('/zones', validate(v.zoneSchema), c.createZone);
dispatch.patch('/zones/:id', validate(v.updateZoneSchema), c.updateZone);

module.exports = { care, transport, dispatch };
