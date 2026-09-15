'use strict';

const { z } = require('zod');

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date')
  // A period cannot have started tomorrow. Catching it here keeps
  // nonsense out of the averages the prediction is built from.
  .refine((value) => Date.parse(value) <= Date.now(), 'That date is in the future');

const createCycleSchema = z.object({
  cycleStartDate: dateOnly,
  cycleEndDate: dateOnly.optional(),
  flow: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
  symptoms: z.array(z.string().max(60)).max(20).optional(),
  mood: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
});

const updateCycleSchema = createCycleSchema.partial();

module.exports = { createCycleSchema, updateCycleSchema };
