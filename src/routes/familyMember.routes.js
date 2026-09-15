'use strict';

const { Router } = require('express');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { loadOwnedFamilyMember } = require('../middleware/ownership');

const { createFamilyMemberSchema, updateFamilyMemberSchema } = require('../validators/familyMember.validator');
const { updateHealthProfileSchema } = require('../validators/healthProfile.validator');
const { createVitalSchema, updateVitalSchema } = require('../validators/vitals.validator');
const { createSymptomSchema, updateSymptomSchema } = require('../validators/symptom.validator');
const { createCycleSchema, updateCycleSchema } = require('../validators/orbit.validator');

const familyMemberController = require('../controllers/familyMember.controller');
const healthProfileController = require('../controllers/healthProfile.controller');
const vitalsController = require('../controllers/vitals.controller');
const timelineController = require('../controllers/timeline.controller');
const insightsController = require('../controllers/insights.controller');
const symptomController = require('../controllers/symptom.controller');
const symptomTrendsController = require('../controllers/symptomTrends.controller');
const orbitController = require('../controllers/orbit.controller');

const router = Router();

// --- Family members (patients) ---
router.post('/', authenticate, requireRole('CLIENT'), validate(createFamilyMemberSchema), familyMemberController.create);
router.get('/', authenticate, requireRole('CLIENT'), familyMemberController.list);
router.get('/:familyMemberId', authenticate, loadOwnedFamilyMember, familyMemberController.get);
router.patch(
  '/:familyMemberId',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateFamilyMemberSchema),
  familyMemberController.update
);

// --- Health profile ---
router.get('/:familyMemberId/health-profile', authenticate, loadOwnedFamilyMember, healthProfileController.get);
router.put(
  '/:familyMemberId/health-profile',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateHealthProfileSchema),
  healthProfileController.update
);

// --- Vitals (health measurements) ---
router.post(
  '/:familyMemberId/vitals',
  authenticate,
  loadOwnedFamilyMember,
  validate(createVitalSchema),
  vitalsController.create
);
router.get('/:familyMemberId/vitals', authenticate, loadOwnedFamilyMember, vitalsController.list);
router.get('/:familyMemberId/vitals/:vitalId', authenticate, loadOwnedFamilyMember, vitalsController.getOne);
router.patch(
  '/:familyMemberId/vitals/:vitalId',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateVitalSchema),
  vitalsController.update
);
router.delete('/:familyMemberId/vitals/:vitalId', authenticate, loadOwnedFamilyMember, vitalsController.remove);

// --- Health timeline & insights ---
router.get('/:familyMemberId/timeline', authenticate, loadOwnedFamilyMember, timelineController.get);
router.get('/:familyMemberId/insights', authenticate, loadOwnedFamilyMember, insightsController.get);

// --- Symptoms (Phase 4) ---
// /symptoms/trends must be registered before /symptoms/:symptomId so
// "trends" isn't swallowed as a symptom id.
router.post(
  '/:familyMemberId/symptoms',
  authenticate,
  loadOwnedFamilyMember,
  validate(createSymptomSchema),
  symptomController.create
);
router.get('/:familyMemberId/symptoms', authenticate, loadOwnedFamilyMember, symptomController.list);
router.get('/:familyMemberId/symptoms/trends', authenticate, loadOwnedFamilyMember, symptomTrendsController.get);
router.get('/:familyMemberId/symptoms/:symptomId', authenticate, loadOwnedFamilyMember, symptomController.getOne);
router.patch(
  '/:familyMemberId/symptoms/:symptomId',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateSymptomSchema),
  symptomController.update
);
router.delete('/:familyMemberId/symptoms/:symptomId', authenticate, loadOwnedFamilyMember, symptomController.remove);

// --- Orbit: period tracking (Phase 9) ---
// /cycles/insights before /cycles/:cycleId, so "insights" is not read
// as an id.
router.post(
  '/:familyMemberId/cycles',
  authenticate,
  loadOwnedFamilyMember,
  validate(createCycleSchema),
  orbitController.create
);
router.get('/:familyMemberId/cycles', authenticate, loadOwnedFamilyMember, orbitController.list);
router.get('/:familyMemberId/cycles/insights', authenticate, loadOwnedFamilyMember, orbitController.insights);
router.get('/:familyMemberId/cycles/:cycleId', authenticate, loadOwnedFamilyMember, orbitController.getOne);
router.patch(
  '/:familyMemberId/cycles/:cycleId',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateCycleSchema),
  orbitController.update
);
router.delete('/:familyMemberId/cycles/:cycleId', authenticate, loadOwnedFamilyMember, orbitController.remove);

module.exports = router;
