'use strict';

const { z } = require('zod');

const createBookingSchema = z.object({
  familyMemberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  locationAddress: z.string().min(3).max(500),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  // House, floor, landmark, how to get in.
  locationDetails: z
    .object({
      house: z.string().max(120).optional(),
      floor: z.string().max(60).optional(),
      landmark: z.string().max(200).optional(),
      contactInstructions: z.string().max(300).optional(),
    })
    .strict()
    .optional(),
  accessibilityNotes: z.string().max(500).optional(),
  timeWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'EXACT']).optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

const failSchema = z.object({
  reason: z.string().min(3).max(500),
});

const assignSchema = z.object({
  staffId: z.string().uuid(),
  overrideReason: z.string().min(3).max(500).optional(),
});

const reasonSchema = z.object({
  reason: z.string().min(2).max(500).optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(2).max(500),
});

const rescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

module.exports = {
  createBookingSchema,
  assignSchema,
  reasonSchema,
  cancelSchema,
  rescheduleSchema,
  failSchema,
};
