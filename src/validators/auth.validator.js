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
  // Optional, and recorded on the client's own SELF family member
  // rather than on the user. It stays optional because signing up must
  // not be blocked on it; what it decides is whether Orbit is offered,
  // and that can be answered later from the profile instead.
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(3, 'Provide your phone or email'), // phone or email
  password: z.string().min(1, 'Password is required'),
});

const googleSignInSchema = z.object({
  idToken: z.string().min(20, 'idToken is required'),
  // Only sent on the second call, once the app has been told a number
  // is still needed. Same rule as registration, so Google cannot be a
  // way in past the phone format.
  phone: z.string().regex(phoneRegex, 'Enter a valid Tanzanian phone number').optional(),
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
  googleSignInSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyRequestSchema,
  verifyConfirmSchema,
};
