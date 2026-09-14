'use strict';

const { z } = require('zod');
const { MEASUREMENT_TYPES } = require('./vitals.validator');

const vitalEntrySchema = z
  .object({
    type: z.enum(MEASUREMENT_TYPES),
    value: z.number().optional(),
    systolic: z.number().int().optional(),
    diastolic: z.number().int().optional(),
    unit: z.string().max(20).optional(),
  })
  .refine(
    (data) => (data.type === 'BLOOD_PRESSURE' ? data.systolic != null && data.diastolic != null : data.value != null),
    { message: 'BLOOD_PRESSURE requires systolic and diastolic; other types require value' }
  );

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.string().max(50).optional(),
});

const updateVisitSchema = z.object({
  assessment: z.string().min(3).max(3000).optional(),
  treatmentNotes: z.string().max(3000).optional(),
  recommendations: z.string().max(3000).optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'followUpDate must be YYYY-MM-DD')
    .optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  vitals: z.array(vitalEntrySchema).max(20).optional(),
});

const checkOutSchema = z.object({
  assessment: z.string().min(3).max(3000).optional(),
});

module.exports = { updateVisitSchema, checkOutSchema };
