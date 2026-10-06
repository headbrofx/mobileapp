'use strict';

const { Op } = require('sequelize');
const { Staff, User, Booking } = require('../models');
const availability = require('./staffAvailability.service');
const location = require('../integrations/location');

// Service category -> preferred staff specialty. A category with no entry
// (or a service with no category) matches any specialty — better to show
// ops a broader candidate list than an empty one.
const CATEGORY_TO_SPECIALTY = {
  Nursing: 'NURSE',
  Care: 'CAREGIVER',
  Rehabilitation: 'PHYSIOTHERAPIST',
  'Maternal Health': 'NURSE',
  Consultation: 'NURSE',
};

// The dispatcher's shortlist for a booking: a recommendation, never an
// assignment. A person confirms every one.
//
// Each candidate carries the reasons behind its place in the list, in
// words, so "why her and not him" has an answer on the screen rather
// than in a formula. People who cannot take the slot (already booked,
// marked away) are still listed, at the bottom and marked ineligible,
// so the dispatcher can see who was ruled out and why.
//
// Scoring is deliberately simple and additive:
//
//   available right now          +30   (busy +10, offline 0)
//   inside their stated hours    +25   (not stated +10, outside -20)
//   declared area matches        +20
//   closer                       up to +25, straight-line from their base
//   experience                   up to +5
//   open visits that day         -5 each
async function recommendForBooking(booking) {
  const specialty = booking.service ? CATEGORY_TO_SPECIALTY[booking.service.category] : undefined;

  const where = { approvalStatus: 'APPROVED' };
  if (specialty) where.specialty = specialty;

  const candidates = await Staff.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'status'] }],
    limit: 200,
  });

  const at = booking.scheduledAt;
  const locationAddress = (booking.locationAddress || '').toLowerCase();

  // How busy each person already is around that day.
  const dayStart = new Date(new Date(at).getTime() - 12 * 3600 * 1000);
  const dayEnd = new Date(new Date(at).getTime() + 12 * 3600 * 1000);
  const loadRows = candidates.length
    ? await Booking.findAll({
        where: {
          staffId: { [Op.in]: candidates.map((c) => c.id) },
          status: { [Op.in]: availability.OPEN_BOOKING },
          scheduledAt: { [Op.between]: [dayStart, dayEnd] },
          id: { [Op.ne]: booking.id },
        },
        attributes: ['staffId'],
      })
    : [];
  const load = {};
  loadRows.forEach((r) => {
    load[r.staffId] = (load[r.staffId] || 0) + 1;
  });

  const conflictsByStaff = await availability.findConflictsForMany(
    candidates.map((c) => c.id),
    at,
    { excludeBookingId: booking.id }
  );

  const scored = [];
  for (const staff of candidates) {
    if (staff.user && staff.user.status === 'SUSPENDED') continue;

    const reasons = [];
    const warnings = [];
    const blockers = [];
    let score = 0;

    if (staff.availability === 'AVAILABLE') {
      score += 30;
      reasons.push('Yupo tayari sasa');
    } else if (staff.availability === 'BUSY') {
      score += 10;
      warnings.push('Ana kazi sasa hivi');
    } else {
      warnings.push('Hayupo mtandaoni sasa');
    }

    const fit = availability.workingHoursFit(staff, at);
    if (fit === 'WITHIN') {
      score += 25;
      reasons.push('Ndani ya saa zake za kazi');
    } else if (fit === 'UNKNOWN') {
      score += 10;
      warnings.push('Hajataja saa zake za kazi');
    } else {
      score -= 20;
      warnings.push('Nje ya saa alizotaja za kazi');
    }

    const areas = Array.isArray(staff.serviceAreas) ? staff.serviceAreas : [];
    const areaMatch = areas.some(
      (area) => typeof area === 'string' && area && locationAddress.includes(area.toLowerCase())
    );
    if (areaMatch) {
      score += 20;
      reasons.push('Anahudumia eneo hili');
    }

    const distanceKm = location.straightLineKm(
      { lat: staff.baseLat, lng: staff.baseLng },
      { lat: booking.locationLat, lng: booking.locationLng }
    );
    if (distanceKm != null) {
      score += Math.max(0, 25 - distanceKm);
      reasons.push(`Takriban km ${distanceKm} (mstari mnyoofu)`);
    }

    if (staff.yearsExperience) score += Math.min(staff.yearsExperience, 10) / 2;

    const openThatDay = load[staff.id] || 0;
    if (openThatDay) {
      score -= 5 * openThatDay;
      warnings.push(`Ana ziara ${openThatDay} siku hiyo`);
    }

    if (availability.isMarkedAway(staff, at)) {
      blockers.push('Amejiweka hayupo hadi baada ya muda huu');
    }
    const conflicts = conflictsByStaff[staff.id] || [];
    if (conflicts.length) {
      blockers.push(`Tayari ana ${conflicts.map((c) => c.reference).join(', ')} muda huo`);
    }

    scored.push({
      id: staff.id,
      name: staff.user ? staff.user.name : null,
      // ADMIN-only route; the dispatcher needs to be able to call.
      phone: staff.user ? staff.user.phone : null,
      specialty: staff.specialty,
      yearsExperience: staff.yearsExperience,
      serviceAreas: staff.serviceAreas,
      availability: staff.availability,
      areaMatch,
      distanceKm,
      workingHours: fit,
      eligible: blockers.length === 0,
      score: Math.round(score * 10) / 10,
      reasons,
      warnings,
      blockers,
    });
  }

  scored.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
  scored.forEach((c, i) => {
    c.rank = i + 1;
  });
  return scored;
}

// Kept for the existing /suggested-staff route: same list and the
// fields it always had, now with the reasons alongside.
async function suggestStaffForBooking(booking) {
  return recommendForBooking(booking);
}

module.exports = { recommendForBooking, suggestStaffForBooking, CATEGORY_TO_SPECIALTY };
