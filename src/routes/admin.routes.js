'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const controller = require('../controllers/admin.controller');

const router = Router();

router.get('/audit-logs', authenticate, requireRole('ADMIN'), controller.listAuditLogs);

module.exports = router;
