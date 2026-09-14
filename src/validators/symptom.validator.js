'use strict';

const { z } = require('zod');

const createSymptomSchema = z.object({
  name: z.string().min(2).max(120),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional().default('MILD'),
  durationValue: z.number().int().positive().optional(),
  durationUnit: z.enum(['HOURS', 'DAYS', 'WEEKS']).optional(),
  frequency: z.enum(['ONE_TIME', 'INTERMITTENT', 'CONSTANT']).optional().default('ONE_TIME'),
  triggers: z.array(z.string()).optional(),
  notes: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});

const updateSymptomSchema = createSymptomSchema.partial();

module.exports = { createSymptomSchema, updateSymptomSchema };
