'use strict';

const { Staff, User } = require('../models');

// Service category -> preferred staff specialty. A category with no entry
// (or a service with no category) matches any specialty — better to show
// ops a broader candidate list than an empty one.
const CATEGORY_TO_SPECIALTY = {
  Nursing: 'NURSE',
  Care: 'CAREGIVER',
  Rehabilitation: 'PHYSIOTHERAPIST',
  'Maternal Health': 'NURSE',
};

// Suggests candidate staff for a booking: APPROVED + AVAILABLE, specialty
// matched to the service category when we have a mapping for it, and
// (loosely) matched to the booking's location by substring against the
// staff's declared service areas. Ops makes the final call via /assign —
// this is a shortlist, not an auto-assignment.
async function suggestStaffForBooking(booking) {
  const specialty = booking.service ? CATEGORY_TO_SPECIALTY[booking.service.category] : undefined;

  const where = {
    approvalStatus: 'APPROVED',
    availability: 'AVAILABLE',
  };
  if (specialty) where.specialty = specialty;

  const candidates = await Staff.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
    limit: 50,
  });

  const locationAddress = (booking.locationAddress || '').toLowerCase();

  const scored = candidates.map((staff) => {
    const areas = Array.isArray(staff.serviceAreas) ? staff.serviceAreas : [];
    const areaMatch = areas.some(
      (area) => typeof area === 'string' && locationAddress.includes(area.toLowerCase())
    );
    return { staff, areaMatch };
  });

  scored.sort((a, b) => Number(b.areaMatch) - Number(a.areaMatch));

  return scored.map(({ staff, areaMatch }) => ({
    id: staff.id,
    name: staff.user ? staff.user.name : null,
    phone: staff.user ? staff.user.phone : null,
    specialty: staff.specialty,
    yearsExperience: staff.yearsExperience,
    serviceAreas: staff.serviceAreas,
    areaMatch,
  }));
}

module.exports = { suggestStaffForBooking, CATEGORY_TO_SPECIALTY };
