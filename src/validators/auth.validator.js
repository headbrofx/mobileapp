'use strict';

const { z } = require('zod');

// Tanzanian phone numbers: accepts 07xxxxxxxx or +2557xxxxxxxx / 2557xxxxxxxx
const phoneRegex = /^(\+?255|0)[67]\d{8}$/;

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  phone: z.string().regex(phoneRegex, 'Enter a valid Tanzanian phone number'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['CLIENT', 'STAFF']).optional().default('CLIENT'),
  specialty: z
    .enum(['NURSE', 'PHYSIOTHERAPIST', 'CAREGIVER', 'GENERAL_PRACTITIONER', 'OPERATIONS', 'OTHER'])
    .optional(), // only used when role === 'STAFF'
});

const loginSchema = z.object({
  identifier: z.string().min(3, 'Provide your phone or email'), // phone or email
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken is required'),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, 'Provide your phone or email'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const verifyRequestSchema = z.object({
  channel: z.enum(['PHONE', 'EMAIL']),
});

const verifyConfirmSchema = z.object({
  channel: z.enum(['PHONE', 'EMAIL']),
  code: z.string().length(6, 'Code must be 6 digits'),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyRequestSchema,
  verifyConfirmSchema,
};
