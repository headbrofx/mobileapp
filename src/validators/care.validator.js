'use strict';

const { z } = require('zod');

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const phone = z.string().regex(/^\+?[0-9]{9,15}$/, 'Phone number must be 9 to 15 digits, optionally starting with +');

const placeDetails = z
  .object({
    house: z.string().max(120).optional(),
    floor: z.string().max(60).optional(),
    landmark: z.string().max(200).optional(),
    contactInstructions: z.string().max(300).optional(),
  })
  .strict();

// --- Transport -------------------------------------------------------------

const createTransportSchema = z.object({
  familyMemberId: z.string().uuid(),
  pickupAddress: z.string().min(3).max(500),
  pickupLat: lat.optional(),
  pickupLng: lng.optional(),
  pickupDetails: placeDetails.optional(),
  destinationType: z.enum(['HOSPITAL', 'CLINIC', 'FACILITY', 'PHARMACY', 'OTHER']),
  destinationName: z.string().min(2).max(200),
  destinationAddress: z.string().max(500).optional(),
  destinationLat: lat.optional(),
  destinationLng: lng.optional(),
  passengerCount: z.number().int().min(1).max(8).optional(),
  scheduledAt: z.string().datetime(),
  mobilityNeeds: z.string().max(500).optional(),
  companionName: z.string().max(120).optional(),
  contactPhone: phone,
  notes: z.string().max(1000).optional(),
  acknowledgedNotEmergency: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

const quoteSchema = z.object({
  fareTzs: z.number().int().min(0).max(10000000),
  note: z.string().max(500).optional(),
});

const reasonRequiredSchema = z.object({
  reason: z.string().min(3).max(500),
});

const reasonOptionalSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

const assignTransportSchema = z
  .object({
    staffId: z.string().uuid().optional(),
    usePartnerApi: z.boolean().optional(),
    partnerName: z.string().max(120).optional(),
    partnerReference: z.string().max(120).optional(),
    driverName: z.string().max(120).optional(),
    driverPhone: phone.optional(),
    vehicleDetails: z.string().max(200).optional(),
  })
  .refine((d) => d.staffId || d.usePartnerApi || d.partnerName || d.driverName, {
    message: 'Choose a staff driver, the partner API, or enter the partner/driver details',
  });

const progressSchema = z.object({
  action: z.enum(['enRoute', 'arrivedPickup', 'startTrip', 'arrivedDestination', 'complete']),
  note: z.string().max(300).optional(),
});

// --- Saved locations -------------------------------------------------------

const savedLocationSchema = z.object({
  label: z.string().min(1).max(60),
  address: z.string().min(3).max(500),
  lat: lat.optional(),
  lng: lng.optional(),
  details: placeDetails.optional(),
  isDefault: z.boolean().optional(),
});

const updateSavedLocationSchema = savedLocationSchema.partial();

// --- Staff availability ----------------------------------------------------

const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:MM, 24-hour');
const dayRanges = z.array(z.object({ from: hhmm, to: hhmm }).refine((r) => r.from < r.to, 'from must be before to')).max(4);

const staffAvailabilitySchema = z.object({
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
  workingHours: z
    .object({
      mon: dayRanges.optional(),
      tue: dayRanges.optional(),
      wed: dayRanges.optional(),
      thu: dayRanges.optional(),
      fri: dayRanges.optional(),
      sat: dayRanges.optional(),
      sun: dayRanges.optional(),
    })
    .strict()
    .nullable()
    .optional(),
  unavailableUntil: z.string().datetime().nullable().optional(),
  serviceAreas: z.array(z.string().min(1).max(100)).max(30).optional(),
  baseLat: lat.nullable().optional(),
  baseLng: lng.nullable().optional(),
});

// --- Admin -----------------------------------------------------------------

const settingsSchema = z.record(z.union([z.number().int(), z.boolean()]));

const zoneSchema = z.object({
  name: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  centerLat: lat,
  centerLng: lng,
  radiusKm: z.number().min(0.5).max(500),
  homeVisits: z.boolean().optional(),
  transport: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const dispatchAssignSchema = z.object({
  staffId: z.string().uuid(),
  overrideReason: z.string().min(3).max(500).optional(),
});

module.exports = {
  createTransportSchema,
  quoteSchema,
  reasonRequiredSchema,
  reasonOptionalSchema,
  assignTransportSchema,
  progressSchema,
  savedLocationSchema,
  updateSavedLocationSchema,
  staffAvailabilitySchema,
  settingsSchema,
  zoneSchema,
  updateZoneSchema: zoneSchema.partial(),
  dispatchAssignSchema,
};
