'use strict';

const { Router } = require('express');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  loadBooking,
  requireBookingViewAccess,
  requireBookingOwnerOrAdmin,
  requireAssignedStaffOrAdmin,
} = require('../middleware/bookingAccess');

const {
  createBookingSchema,
  assignSchema,
  reasonSchema,
  cancelSchema,
  rescheduleSchema,
} = require('../validators/booking.validator');
const { updateVisitSchema, checkOutSchema } = require('../validators/visit.validator');
const { createLocationPingSchema } = require('../validators/location.validator');

const controller = require('../controllers/booking.controller');
const visitController = require('../controllers/visit.controller');
const locationController = require('../controllers/location.controller');

const router = Router();

// --- Create & browse ---
router.post('/', authenticate, requireRole('CLIENT'), validate(createBookingSchema), controller.create);
router.get('/', authenticate, controller.list); // role-scoped inside the service

router.get('/:bookingId', authenticate, loadBooking, requireBookingViewAccess, controller.getOne);

// ADMIN-only: shortlist of candidate staff for a booking.
router.get('/:bookingId/suggested-staff', authenticate, requireRole('ADMIN'), loadBooking, controller.suggestedStaff);

// --- Lifecycle transitions ---
router.patch(
  '/:bookingId/assign',
  authenticate,
  requireRole('ADMIN'),
  loadBooking,
  validate(assignSchema),
  controller.assign
);

router.patch(
  '/:bookingId/accept',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  controller.accept
);

router.patch(
  '/:bookingId/reject',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  validate(reasonSchema),
  controller.reject
);

router.patch(
  '/:bookingId/on-the-way',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  controller.onTheWay
);

router.patch(
  '/:bookingId/arrive',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  controller.arrive
);

router.patch(
  '/:bookingId/start',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  controller.start
);

router.patch(
  '/:bookingId/complete',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  controller.complete
);

router.patch(
  '/:bookingId/cancel',
  authenticate,
  loadBooking,
  requireBookingOwnerOrAdmin,
  validate(cancelSchema),
  controller.cancel
);

router.patch(
  '/:bookingId/reschedule',
  authenticate,
  loadBooking,
  requireBookingOwnerOrAdmin,
  validate(rescheduleSchema),
  controller.reschedule
);

// --- Clinical visit record (Phase 6) ---
router.get('/:bookingId/visit', authenticate, loadBooking, requireBookingViewAccess, visitController.get);
router.post(
  '/:bookingId/visit/check-in',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  visitController.checkIn
);
router.patch(
  '/:bookingId/visit',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  validate(updateVisitSchema),
  visitController.update
);
router.post(
  '/:bookingId/visit/check-out',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  validate(checkOutSchema),
  visitController.checkOut
);

// --- Live location tracking (Phase 7) ---
router.post(
  '/:bookingId/location',
  authenticate,
  loadBooking,
  requireAssignedStaffOrAdmin,
  validate(createLocationPingSchema),
  locationController.recordPing
);
router.get('/:bookingId/location', authenticate, loadBooking, requireBookingViewAccess, locationController.getCurrent);
router.get(
  '/:bookingId/location/history',
  authenticate,
  loadBooking,
  requireBookingViewAccess,
  locationController.getHistory
);

module.exports = router;
