'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateClientProfileSchema } = require('../validators/clientProfile.validator');
const controller = require('../controllers/clientProfile.controller');

const router = Router();

// Always the caller's own profile — there is no :userId in the path, so
// there is no id for one client to swap for another's.
router.get('/', authenticate, requireRole('CLIENT'), controller.get);
router.patch(
  '/',
  authenticate,
  requireRole('CLIENT'),
  validate(updateClientProfileSchema),
  controller.update
);

module.exports = router;
