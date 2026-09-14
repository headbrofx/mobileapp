'use strict';

const { z } = require('zod');

const MEASUREMENT_TYPES = [
  'BLOOD_PRESSURE',
  'BLOOD_GLUCOSE',
  'HEART_RATE',
  'TEMPERATURE',
  'OXYGEN_SATURATION',
  'WEIGHT',
  'HEIGHT',
  'BMI',
];

const createVitalSchema = z
  .object({
    type: z.enum(MEASUREMENT_TYPES),
    value: z.number().optional(),
    systolic: z.number().int().optional(),
    diastolic: z.number().int().optional(),
    unit: z.string().max(20).optional(),
    notes: z.string().optional(),
    recordedAt: z.string().datetime().optional(),
  })
  .refine(
    (data) => (data.type === 'BLOOD_PRESSURE' ? data.systolic != null && data.diastolic != null : data.value != null),
    { message: 'BLOOD_PRESSURE requires systolic and diastolic; other types require value' }
  );

const updateVitalSchema = z.object({
  value: z.number().optional(),
  systolic: z.number().int().optional(),
  diastolic: z.number().int().optional(),
  unit: z.string().max(20).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().datetime().optional(),
});

module.exports = { createVitalSchema, updateVitalSchema, MEASUREMENT_TYPES };
