'use strict';

const { z } = require('zod');

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
});

const updateHealthProfileSchema = z.object({
  conditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  medications: z.array(medicationSchema).optional(),
  medicalHistory: z.string().optional(),
  bloodType: z.string().max(10).optional(),
  heightCm: z.number().positive().optional(),
  notes: z.string().optional(),
});

module.exports = { updateHealthProfileSchema };
