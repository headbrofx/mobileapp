'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateMyStaffProfileSchema } = require('../validators/staff.validator');
const controller = require('../controllers/staff.controller');

const router = Router();

// Staff accounts are created via /api/auth/register (role: STAFF) with
// approvalStatus PENDING, then approved/rejected here by an admin —
// per the "staff accounts created/approved by admin" requirement.
router.get('/', authenticate, requireRole('ADMIN'), controller.list);
router.get('/me', authenticate, requireRole('STAFF'), controller.me);
router.patch(
  '/me',
  authenticate,
  requireRole('STAFF'),
  validate(updateMyStaffProfileSchema),
  controller.updateMe
);
router.get('/me/schedule', authenticate, requireRole('STAFF'), controller.mySchedule);
router.patch('/:id/approve', authenticate, requireRole('ADMIN'), controller.approve);
router.patch('/:id/reject', authenticate, requireRole('ADMIN'), controller.reject);

module.exports = router;
