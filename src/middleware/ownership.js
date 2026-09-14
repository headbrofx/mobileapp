'use strict';

const { FamilyMember, ClientProfile } = require('../models');
const AppError = require('../utils/appError');

// Loads the FamilyMember named by req.params.familyMemberId and confirms
// the authenticated user is allowed to touch it: they own it (via their
// ClientProfile) or they're an ADMIN. STAFF access is scoped to active
// bookings/visits, not added until Phase 5/6 need it.
async function loadOwnedFamilyMember(req, res, next) {
  try {
    const familyMember = await FamilyMember.findByPk(req.params.familyMemberId);
    if (!familyMember) {
      throw AppError.notFound('Family member not found');
    }

    if (req.user.role === 'ADMIN') {
      req.familyMember = familyMember;
      return next();
    }

    const clientProfile = await ClientProfile.findByPk(familyMember.clientProfileId);
    if (!clientProfile || clientProfile.userId !== req.user.id) {
      throw AppError.forbidden('You do not have access to this family member');
    }

    req.familyMember = familyMember;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { loadOwnedFamilyMember };
