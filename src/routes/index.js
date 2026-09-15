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

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/staff', staffRoutes);
router.use('/admin', adminRoutes);
router.use('/family-members', familyMemberRoutes);
router.use('/symptom-catalogue', symptomCatalogRoutes);
router.use('/bookings', bookingRoutes);
router.use('/ai', aiRoutes);
router.use('/foods', foodRoutes);

// Phase 6+ will mount: /visits, ...

module.exports = router;
