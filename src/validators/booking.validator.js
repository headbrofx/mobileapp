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
});

const assignSchema = z.object({
  staffId: z.string().uuid(),
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
};
