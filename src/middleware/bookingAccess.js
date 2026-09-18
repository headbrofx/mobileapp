'use strict';

const { Booking, ClientProfile, Staff, FamilyMember, Service, User } = require('../models');
const AppError = require('../utils/appError');

const DETAIL_INCLUDE = [
  { model: FamilyMember, as: 'patient' },
  { model: Service, as: 'service' },
  {
    model: Staff,
    as: 'staff',
    // The client is entitled to know who is coming to their house, so
    // the nurse's name travels with the booking. Name only — a client
    // has no business with a staff member's phone number or email, and
    // a nested include is exactly the place that leaks them by
    // accident.
    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
  },
];

// Loads the Booking named by req.params.bookingId. Access checks are kept
// separate (below) so different actions can require different levels of
// access (view vs owner-only vs assigned-staff-only) on the same resource.
async function loadBooking(req, res, next) {
  try {
    const booking = await Booking.findByPk(req.params.bookingId, { include: DETAIL_INCLUDE });
    if (!booking) {
      throw AppError.notFound('Booking not found');
    }
    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
}

// ADMIN, the client who owns the booking, or the currently-assigned staff
// member may view it.
async function requireBookingViewAccess(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();

    if (req.user.role === 'CLIENT') {
      const clientProfile = await ClientProfile.findOne({ where: { userId: req.user.id } });
      if (clientProfile && clientProfile.id === req.booking.clientProfileId) return next();
    }

    if (req.user.role === 'STAFF') {
      const staff = await Staff.findOne({ where: { userId: req.user.id } });
      if (staff && req.booking.staffId && staff.id === req.booking.staffId) return next();
    }

    throw AppError.forbidden('You do not have access to this booking');
  } catch (err) {
    next(err);
  }
}

// ADMIN or the client who owns the booking — used for cancel/reschedule,
// actions the client (or support, on their behalf) initiates.
async function requireBookingOwnerOrAdmin(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();

    if (req.user.role === 'CLIENT') {
      const clientProfile = await ClientProfile.findOne({ where: { userId: req.user.id } });
      if (clientProfile && clientProfile.id === req.booking.clientProfileId) return next();
    }

    throw AppError.forbidden('You do not have access to this booking');
  } catch (err) {
    next(err);
  }
}

// The staff member currently assigned to the booking (or ADMIN, for
// support/override purposes) — used for accept/reject/on-the-way/
// arrive/start/complete.
async function requireAssignedStaffOrAdmin(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();

    if (req.user.role === 'STAFF') {
      const staff = await Staff.findOne({ where: { userId: req.user.id } });
      if (staff && req.booking.staffId && staff.id === req.booking.staffId) {
        req.staffProfile = staff;
        return next();
      }
    }

    throw AppError.forbidden('You are not the staff member assigned to this booking');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  DETAIL_INCLUDE,
  loadBooking,
  requireBookingViewAccess,
  requireBookingOwnerOrAdmin,
  requireAssignedStaffOrAdmin,
};
