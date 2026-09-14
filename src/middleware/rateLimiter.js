'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { error } = require('../utils/apiResponse');

// General limiter for the whole API.
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    error(res, {
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMITED',
    }),
});

// Tighter limiter for auth endpoints (login/register) to slow down
// brute-force and credential-stuffing attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    error(res, {
      statusCode: 429,
      message: 'Too many auth attempts, please try again later.',
      code: 'RATE_LIMITED',
    }),
});

module.exports = { apiLimiter, authLimiter };
