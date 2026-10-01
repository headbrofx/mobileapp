'use strict';

const { ServiceZone } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');
const { haversineKm } = require('../utils/geo');

async function listActive() {
  return ServiceZone.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
}

async function listAll() {
  return ServiceZone.findAll({ order: [['name', 'ASC']] });
}

// The nearest active zone whose circle contains the point and which
// offers `kind` ('homeVisits' or 'transport'). Null when the point is
// outside every one of them, or when no coordinates were given: a
// typed address with no pin cannot be placed, and guessing would be
// worse than leaving it to the dispatcher.
async function zoneFor(lat, lng, kind) {
  if (lat == null || lng == null) return null;

  const zones = await listActive();
  const inside = zones
    .filter((z) => !kind || z[kind])
    .map((z) => ({ zone: z, km: haversineKm(lat, lng, z.centerLat, z.centerLng) }))
    .filter(({ zone, km }) => km <= zone.radiusKm)
    .sort((a, b) => a.km - b.km);

  return inside.length ? inside[0].zone : null;
}

// Coverage is only refused when the client gave a pin and it is
// outside every zone. No pin means "the dispatcher will read the
// address", which is how it worked before zones existed.
async function assertCovered(lat, lng, kind) {
  if (lat == null || lng == null) return null;
  const zone = await zoneFor(lat, lng, kind);
  if (!zone) {
    throw new AppError(
      'Samahani, eneo hili bado haliko kwenye maeneo tunayohudumia. / This location is outside our current service areas.',
      422,
      'OUT_OF_SERVICE_AREA'
    );
  }
  return zone;
}

const EDITABLE = ['name', 'region', 'centerLat', 'centerLng', 'radiusKm', 'homeVisits', 'transport', 'isActive'];

async function create(data, actorUser, req) {
  const zone = await ServiceZone.create(Object.fromEntries(EDITABLE.filter((k) => data[k] !== undefined).map((k) => [k, data[k]])));
  await logAudit({ userId: actorUser.id, action: 'ZONE_CREATED', entityType: 'ServiceZone', entityId: zone.id, req, metadata: data });
  return zone;
}

async function update(id, data, actorUser, req) {
  const zone = await ServiceZone.findByPk(id);
  if (!zone) throw AppError.notFound('Zone not found');
  EDITABLE.forEach((k) => {
    if (data[k] !== undefined) zone[k] = data[k];
  });
  await zone.save();
  await logAudit({ userId: actorUser.id, action: 'ZONE_UPDATED', entityType: 'ServiceZone', entityId: zone.id, req, metadata: data });
  return zone;
}

module.exports = { listActive, listAll, zoneFor, assertCovered, create, update };
