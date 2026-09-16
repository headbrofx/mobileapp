'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createInvoiceSchema,
  recordPaymentSchema,
  cancelInvoiceSchema,
} = require('../validators/billing.validator');
const controller = require('../controllers/billing.controller');

const router = Router();

// "outstanding" before "/:id" so it is not read as an invoice id.
router.get('/outstanding', authenticate, requireRole('ADMIN'), controller.outstanding);

router.get('/', authenticate, controller.list);
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(createInvoiceSchema),
  controller.create
);

router.get('/:id', authenticate, controller.getOne);
router.post('/:id/issue', authenticate, requireRole('ADMIN', 'STAFF'), controller.issue);
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('ADMIN'),
  validate(cancelInvoiceSchema),
  controller.cancel
);
router.post(
  '/:id/payments',
  authenticate,
  requireRole('ADMIN', 'STAFF'),
  validate(recordPaymentSchema),
  controller.recordPayment
);

module.exports = router;
