'use strict';

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const staffRoutes = require('./staff.routes');
const adminRoutes = require('./admin.routes');
const familyMemberRoutes = require('./familyMember.routes');
const symptomCatalogRoutes = require('./symptomCatalog.routes');
const bookingRoutes = require('./booking.routes');
const aiRoutes = require('./ai.routes');
const foodRoutes = require('./food.routes');
const serviceRoutes = require('./service.routes');
const notificationRoutes = require('./notification.routes');
const contentRoutes = require('./content.routes');
const billingRoutes = require('./billing.routes');
const docsRoutes = require('./docs.routes');

const router = Router();

router.use('/', healthRoutes);
router.use('/', docsRoutes);
router.use('/auth', authRoutes);
router.use('/staff', staffRoutes);
router.use('/admin', adminRoutes);
router.use('/family-members', familyMemberRoutes);
router.use('/symptom-catalogue', symptomCatalogRoutes);
router.use('/bookings', bookingRoutes);
router.use('/ai', aiRoutes);
router.use('/foods', foodRoutes);
router.use('/services', serviceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/content', contentRoutes);
router.use('/invoices', billingRoutes);

// Phase 6+ will mount: /visits, ...

module.exports = router;
