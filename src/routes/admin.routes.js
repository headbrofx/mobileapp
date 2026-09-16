'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { setUserStatusSchema, setUserRoleSchema } = require('../validators/admin.validator');
const controller = require('../controllers/admin.controller');
const analyticsController = require('../controllers/analytics.controller');

const router = Router();

// Everything below is ADMIN only.
router.use(authenticate, requireRole('ADMIN'));

router.get('/dashboard', controller.dashboard);
router.get('/audit-logs', controller.listAuditLogs);

router.get('/users', controller.listUsers);
router.patch('/users/:id/status', validate(setUserStatusSchema), controller.setUserStatus);
// The most sensitive endpoint in the API. Audited, and an admin cannot
// point it at themselves.
router.patch('/users/:id/role', validate(setUserRoleSchema), controller.setUserRole);

// Aggregates only — no row here names a patient (Phase 16).
router.get('/analytics', analyticsController.overview);

router.get('/staff', controller.listStaff);
router.get('/bookings', controller.listBookings);

module.exports = router;
