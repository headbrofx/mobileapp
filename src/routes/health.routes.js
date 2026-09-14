'use strict';

const { Router } = require('express');
const { sequelize } = require('../models');
const { success, error } = require('../utils/apiResponse');

const router = Router();

// Simple liveness check — no DB dependency.
router.get('/health', (req, res) => {
  return success(res, { message: 'Afya Nyumbani API is running', data: { uptime: process.uptime() } });
});

// Readiness check — confirms the database connection is actually alive.
// Useful for Phase 0 acceptance ("database iko connected").
router.get('/health/db', async (req, res) => {
  try {
    await sequelize.authenticate();
    return success(res, { message: 'Database connection OK' });
  } catch (err) {
    return error(res, { statusCode: 503, message: 'Database connection failed', code: 'DB_UNAVAILABLE' });
  }
});

module.exports = router;
