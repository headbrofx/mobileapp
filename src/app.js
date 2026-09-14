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
