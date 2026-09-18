'use strict';

const { z } = require('zod');

// Same rule as registration, so an emergency number cannot be saved in
// a shape nobody can dial.
const phoneRegex = /^(\+?255|0)[67]\d{8}$/;

const updateClientProfileSchema = z.object({
  address: z.string().min(3).max(500).optional(),
  city: z.string().min(2).max(120).optional(),
  emergencyContactName: z.string().min(2).max(120).optional(),
  emergencyContactPhone: z
    .string()
    .regex(phoneRegex, 'Enter a valid Tanzanian phone number')
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  emergencyContactRelationship: z.string().min(2).max(60).optional(),
});

module.exports = { updateClientProfileSchema };
