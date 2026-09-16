'use strict';

const { z } = require('zod');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time as HH:MM');

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date');

const createMedicationSchema = z.object({
  name: z.string().min(2).max(120),
  // Free text, kept exactly as the prescriber wrote it. Never parsed,
  // converted or recalculated.
  dosage: z.string().min(1).max(80),
  form: z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'INHALER', 'OTHER']).optional().default('TABLET'),
  scheduleTimes: z.array(hhmm).min(1).max(8),
  instructions: z.string().max(2000).optional(),
  startDate: dateOnly,
  endDate: dateOnly.optional(),
  prescribedBy: z.string().max(160).optional(),
});

const updateMedicationSchema = createMedicationSchema
  .partial()
  .extend({ status: z.enum(['ACTIVE', 'COMPLETED', 'STOPPED']).optional() });

const markDoseSchema = z.object({
  status: z.enum(['TAKEN', 'MISSED', 'SKIPPED']),
  note: z.string().max(1000).optional(),
});

module.exports = { createMedicationSchema, updateMedicationSchema, markDoseSchema };
