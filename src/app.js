'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Render terminates TLS at its own proxy and forwards the real client
// address in X-Forwarded-For. Without this, req.ip is the proxy's
// address, which breaks two things quietly:
//
//   * the rate limiter buckets every user on the internet into one
//     counter, so one noisy client exhausts the limit for everybody and
//     the per-IP brute-force guard on /auth/login stops guarding
//     anything;
//   * every audit log records the proxy's address instead of the
//     person's, which makes the IP column worthless exactly when it
//     matters.
//
// 1, not true: trusting one hop means the address is the one Render
// put there. Trusting all of them would let a caller set
// X-Forwarded-For themselves and pick their own rate-limit bucket.
app.set('trust proxy', 1);

// Security baseline
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  })
);
app.use(apiLimiter);

// Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// API routes
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ name: 'Afya Nyumbani API', status: 'ok', docs: '/api/health' });
});

// 404 + centralized error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
