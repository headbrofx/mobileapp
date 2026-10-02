'use strict';

const { Op } = require('sequelize');
const { Booking, TransportRequest, ClientProfile, SavedLocation, Service, Staff } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const zones = require('./zone.service');
const history = require('./statusHistory.service');
const locationService = require('./location.service');
const transport = require('./transport.service');
const settings = require('./settings.service');
const location = require('../integrations/location');
const payments = require('../integrations/payments');
const { DETAIL_INCLUDE } = require('../middleware/bookingAccess');
const { CATEGORY_TO_SPECIALTY } = require('./staffMatch.service');

// --- Find Care Near You ----------------------------------------------------
//
// What a client can get where they are, without telling anybody where
// that is. The coordinates are rounded to about a kilometre on arrival
// and are not stored or logged. Individual nurses are never located on
// a client's screen: the answer is "covered, and N people are on duty
// for this kind of care", not a map of where they are.
async function discover({ lat, lng } = {}) {
  const approx = location.approximate(lat, lng);
  const activeZones = await zones.listActive();

  let zone = null;
  let coverage = 'UNKNOWN';
  if (approx) {
    zone = await zones.zoneFor(approx.lat, approx.lng, null);
    coverage = zone ? 'COVERED' : 'OUTSIDE';
  }

  const services = await Service.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });

  // On-duty counts by specialty, from real staff rows.
  const onDuty = await Staff.findAll({
    where: { approvalStatus: 'APPROVED', availability: 'AVAILABLE' },
    attributes: ['specialty'],
  });
  const bySpecialty = {};
  onDuty.forEach((s) => {
    bySpecialty[s.specialty] = (bySpecialty[s.specialty] || 0) + 1;
  });

  const [transportEnabled, minLeadMinutes] = await Promise.all([
    settings.get('transport.enabled'),
    settings.get('booking.minLeadMinutes'),
  ]);

  return {
    location: approx ? { approximate: true, ...approx } : null,
    coverage,
    zone: zone ? { id: zone.id, name: zone.name, region: zone.region, homeVisits: zone.homeVisits, transport: zone.transport } : null,
    // Centre and radius are the business's own published coverage, not
    // anybody's location, so the app can draw them and start its map
    // there without a city written into it.
    zones: activeZones.map((z) => ({
      id: z.id,
      name: z.name,
      region: z.region,
      homeVisits: z.homeVisits,
      transport: z.transport,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusKm: z.radiusKm,
    })),
    homeVisits: {
      available: coverage !== 'OUTSIDE' && (!zone || zone.homeVisits),
      minLeadMinutes,
      services: services.map((s) => {
        const specialty = CATEGORY_TO_SPECIALTY[s.category];
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          basePriceTzs: s.basePriceTzs,
          durationMinutes: s.durationMinutes,
          // A count of people on duty now, not a promise of who comes.
          onDutyNow: specialty ? bySpecialty[specialty] || 0 : onDuty.length,
        };
      }),
    },
    transport: {
      available: Boolean(transportEnabled) && coverage !== 'OUTSIDE' && (!zone || zone.transport),
      pricing: 'QUOTED_PER_TRIP',
    },
    payments: payments.describe(),
    maps: location.describe(),
  };
}

// --- My Care Requests ------------------------------------------------------
//
// Visits and trips together, for every member of the family the client
// manages, sorted into the four tabs the app shows.
const TABS = {
  upcoming: { booking: ['REQUESTED', 'UNDER_REVIEW', 'ASSIGNED', 'ACCEPTED', 'RESCHEDULED', 'REJECTED'], transport: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'ASSIGNED'] },
  active: { booking: ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'], transport: ['EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION'] },
  completed: { booking: ['COMPLETED'], transport: ['COMPLETED'] },
  cancelled: { booking: ['CANCELLED', 'FAILED', 'EXPIRED'], transport: ['CANCELLED', 'REJECTED', 'FAILED', 'EXPIRED'] },
};

function bookingItem(b) {
  return {
    kind: 'HOME_VISIT',
    id: b.id,
    reference: b.bookingReference,
    status: b.status,
    scheduledAt: b.scheduledAt,
    title: b.service ? b.service.name : 'Ziara ya nyumbani',
    patient: b.patient ? { id: b.patient.id, name: b.patient.name } : null,
    place: b.locationAddress,
    staffName: b.staff && b.staff.user ? b.staff.user.name : null,
    priceTzs: b.confirmedPriceTzs ?? b.quotedPriceTzs ?? null,
  };
}

function tripItem(t) {
  return {
    kind: 'TRANSPORT',
    id: t.id,
    reference: t.bookingReference,
    status: t.status,
    scheduledAt: t.scheduledAt,
    title: t.destinationName,
    patient: t.patient ? { id: t.patient.id, name: t.patient.name } : null,
    place: t.pickupAddress,
    staffName: t.driver ? t.driver.name || (t.driver.user && t.driver.user.name) || null : t.driverName || null,
    priceTzs: t.confirmedFareTzs ?? t.quotedFareTzs ?? null,
    awaitingClient: t.status === 'QUOTED',
  };
}

async function myRequests(user, { tab = 'upcoming', familyMemberId } = {}) {
  const def = TABS[tab];
  if (!def) throw AppError.badRequest('tab must be upcoming, active, completed or cancelled');

  const profile = await ClientProfile.findOne({ where: { userId: user.id } });
  if (!profile) return { tab, items: [], counts: {} };

  const memberFilter = familyMemberId ? { familyMemberId } : {};

  const [bookings, trips] = await Promise.all([
    Booking.findAll({
      where: { clientProfileId: profile.id, status: { [Op.in]: def.booking }, ...memberFilter },
      include: DETAIL_INCLUDE,
      order: [['scheduledAt', tab === 'upcoming' || tab === 'active' ? 'ASC' : 'DESC']],
      limit: 100,
    }),
    transport.list(user, { limit: 200 }),
  ]);

  const tripItems = trips
    .filter((t) => def.transport.includes(t.status) && (!familyMemberId || t.familyMemberId === familyMemberId))
    .map(tripItem);

  const items = [...bookings.map(bookingItem), ...tripItems].sort((a, b) => {
    const d = new Date(a.scheduledAt) - new Date(b.scheduledAt);
    return tab === 'upcoming' || tab === 'active' ? d : -d;
  });

  // Counts for the tab badges, cheaply.
  const counts = {};
  for (const [name, t] of Object.entries(TABS)) {
    const n = await Booking.count({ where: { clientProfileId: profile.id, status: { [Op.in]: t.booking }, ...memberFilter } });
    counts[name] = n + trips.filter((x) => t.transport.includes(x.status) && (!familyMemberId || x.familyMemberId === familyMemberId)).length;
  }

  return { tab, items, counts };
}

// --- Tracking --------------------------------------------------------------

// The timeline of a visit or trip, plus where the nurse is when she is
// on the way and sharing. No ETA unless a routing provider is connected
// (see integrations/location): a straight line is a distance, not a
// drive time.
async function track(user, kind, id) {
  if (kind === 'HOME_VISIT') {
    const booking = await Booking.findByPk(id, { include: DETAIL_INCLUDE });
    if (!booking) throw AppError.notFound('Booking not found');
    await assertBookingView(user, booking);

    const live = booking.status === 'ON_THE_WAY' ? await locationService.getCurrent(booking.id) : null;
    return {
      kind,
      item: bookingItem(booking),
      details: {
        locationLat: booking.locationLat,
        locationLng: booking.locationLng,
        locationDetails: booking.locationDetails,
        accessibilityNotes: booking.accessibilityNotes,
        timeWindow: booking.timeWindow,
        notes: booking.notes,
        cancellationReason: booking.cancellationReason,
      },
      timeline: await history.timeline('BOOKING', booking.id, { forClient: user.role !== 'ADMIN' }),
      live,
    };
  }

  if (kind === 'TRANSPORT') {
    const trip = await transport.getOne(user, id);
    return {
      kind,
      item: tripItem(trip),
      details: trip,
      timeline: await history.timeline('TRANSPORT', id, { forClient: user.role !== 'ADMIN' }),
      live: null,
    };
  }

  throw AppError.badRequest('kind must be HOME_VISIT or TRANSPORT');
}

async function assertBookingView(user, booking) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'CLIENT') {
    const profile = await ClientProfile.findOne({ where: { userId: user.id } });
    if (profile && profile.id === booking.clientProfileId) return;
  }
  if (user.role === 'STAFF') {
    const staff = await Staff.findOne({ where: { userId: user.id } });
    if (staff && booking.staffId === staff.id) return;
  }
  throw AppError.forbidden('You do not have access to this booking');
}

// --- Saved locations -------------------------------------------------------

async function ownProfile(user) {
  const profile = await ClientProfile.findOne({ where: { userId: user.id } });
  if (!profile) throw AppError.badRequest('No client profile for this account');
  return profile;
}

async function listLocations(user) {
  const profile = await ownProfile(user);
  return SavedLocation.findAll({ where: { clientProfileId: profile.id }, order: [['isDefault', 'DESC'], ['createdAt', 'ASC']] });
}

async function clearDefault(profileId, exceptId) {
  await SavedLocation.update({ isDefault: false }, { where: { clientProfileId: profileId, id: { [Op.ne]: exceptId } } });
}

async function createLocation(user, data) {
  const profile = await ownProfile(user);
  const count = await SavedLocation.count({ where: { clientProfileId: profile.id } });
  if (count >= 20) throw AppError.badRequest('At most 20 saved places');
  const loc = await SavedLocation.create({ ...data, clientProfileId: profile.id, isDefault: data.isDefault ?? count === 0 });
  if (loc.isDefault) await clearDefault(profile.id, loc.id);
  return loc;
}

// Scoped to the caller's own profile in the query itself, so another
// client's id simply is not found.
async function updateLocation(user, id, data) {
  const profile = await ownProfile(user);
  const loc = await SavedLocation.findOne({ where: { id, clientProfileId: profile.id } });
  if (!loc) throw AppError.notFound('Saved place not found');
  Object.assign(loc, data);
  await loc.save();
  if (loc.isDefault) await clearDefault(profile.id, loc.id);
  return loc;
}

async function deleteLocation(user, id, req) {
  const profile = await ownProfile(user);
  const loc = await SavedLocation.findOne({ where: { id, clientProfileId: profile.id } });
  if (!loc) throw AppError.notFound('Saved place not found');
  await loc.destroy();
  await logAudit({ userId: user.id, action: 'SAVED_LOCATION_DELETED', entityType: 'SavedLocation', entityId: id, req });
}

module.exports = {
  discover,
  myRequests,
  track,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  TABS,
};
