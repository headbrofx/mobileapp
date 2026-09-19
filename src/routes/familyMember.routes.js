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
const {
  updateNutritionProfileSchema,
  logMealSchema,
  logWaterSchema,
} = require('../validators/nutrition.validator');
const {
  updateFitnessProfileSchema,
  logWorkoutSchema,
  upsertActivitySchema,
} = require('../validators/fitness.validator');
const {
  createMedicationSchema,
  updateMedicationSchema,
  markDoseSchema,
} = require('../validators/medication.validator');

const familyMemberController = require('../controllers/familyMember.controller');
const healthProfileController = require('../controllers/healthProfile.controller');
const vitalsController = require('../controllers/vitals.controller');
const timelineController = require('../controllers/timeline.controller');
const insightsController = require('../controllers/insights.controller');
const symptomController = require('../controllers/symptom.controller');
const symptomTrendsController = require('../controllers/symptomTrends.controller');
const orbitController = require('../controllers/orbit.controller');
const nutritionController = require('../controllers/nutrition.controller');
const fitnessController = require('../controllers/fitness.controller');
const medicationController = require('../controllers/medication.controller');

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
//
// PATCH and PUT both land on the same handler, and PATCH is the honest
// one: healthProfile.service only assigns the fields that arrive, so a
// request carrying conditions leaves allergies and blood group exactly
// as they were. That is a merge, which is what PATCH means. It was
// mounted as PUT alone, so the sign-up flow — which sends a partial
// profile and has always sent PATCH — failed on "Route not found" at
// the last step, for everybody, since the day it was written.
//
// PUT stays because a caller already uses it and removing a working
// route to tidy a verb is not worth breaking anything for.
router.get('/:familyMemberId/health-profile', authenticate, loadOwnedFamilyMember, healthProfileController.get);
router.patch(
  '/:familyMemberId/health-profile',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateHealthProfileSchema),
  healthProfileController.update
);
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

// --- Nutrition (Phase 10) ---
router.get('/:familyMemberId/nutrition', authenticate, loadOwnedFamilyMember, nutritionController.getProfile);
router.put(
  '/:familyMemberId/nutrition',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateNutritionProfileSchema),
  nutritionController.updateProfile
);
router.get('/:familyMemberId/nutrition/summary', authenticate, loadOwnedFamilyMember, nutritionController.dailySummary);

router.post(
  '/:familyMemberId/meals',
  authenticate,
  loadOwnedFamilyMember,
  validate(logMealSchema),
  nutritionController.logMeal
);
router.get('/:familyMemberId/meals', authenticate, loadOwnedFamilyMember, nutritionController.listMeals);
router.delete('/:familyMemberId/meals/:mealId', authenticate, loadOwnedFamilyMember, nutritionController.deleteMeal);

router.post(
  '/:familyMemberId/water',
  authenticate,
  loadOwnedFamilyMember,
  validate(logWaterSchema),
  nutritionController.logWater
);
router.get('/:familyMemberId/water', authenticate, loadOwnedFamilyMember, nutritionController.listWater);
router.delete('/:familyMemberId/water/:waterId', authenticate, loadOwnedFamilyMember, nutritionController.deleteWater);

// --- Fitness (Phase 11) ---
router.get('/:familyMemberId/fitness', authenticate, loadOwnedFamilyMember, fitnessController.getProfile);
router.put(
  '/:familyMemberId/fitness',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateFitnessProfileSchema),
  fitnessController.updateProfile
);
router.get('/:familyMemberId/fitness/summary', authenticate, loadOwnedFamilyMember, fitnessController.summary);

router.post(
  '/:familyMemberId/workouts',
  authenticate,
  loadOwnedFamilyMember,
  validate(logWorkoutSchema),
  fitnessController.logWorkout
);
router.get('/:familyMemberId/workouts', authenticate, loadOwnedFamilyMember, fitnessController.listWorkouts);
router.delete(
  '/:familyMemberId/workouts/:workoutId',
  authenticate,
  loadOwnedFamilyMember,
  fitnessController.deleteWorkout
);

// One row per day, so sending the same date twice corrects it rather
// than adding to it.
router.put(
  '/:familyMemberId/activity',
  authenticate,
  loadOwnedFamilyMember,
  validate(upsertActivitySchema),
  fitnessController.upsertActivity
);
router.get('/:familyMemberId/activity', authenticate, loadOwnedFamilyMember, fitnessController.listActivity);

// --- Medications & reminders (Phase 12) ---
// The specific paths come before /:medicationId so "doses", "due" and
// "adherence" are not read as ids.
router.post(
  '/:familyMemberId/medications',
  authenticate,
  loadOwnedFamilyMember,
  validate(createMedicationSchema),
  medicationController.create
);
router.get('/:familyMemberId/medications', authenticate, loadOwnedFamilyMember, medicationController.list);
router.get('/:familyMemberId/medications/doses', authenticate, loadOwnedFamilyMember, medicationController.listDoses);
router.get('/:familyMemberId/medications/due', authenticate, loadOwnedFamilyMember, medicationController.dueDoses);
router.get(
  '/:familyMemberId/medications/adherence',
  authenticate,
  loadOwnedFamilyMember,
  medicationController.adherence
);
router.post(
  '/:familyMemberId/medications/doses/:doseId',
  authenticate,
  loadOwnedFamilyMember,
  validate(markDoseSchema),
  medicationController.markDose
);
router.get(
  '/:familyMemberId/medications/:medicationId',
  authenticate,
  loadOwnedFamilyMember,
  medicationController.getOne
);
router.patch(
  '/:familyMemberId/medications/:medicationId',
  authenticate,
  loadOwnedFamilyMember,
  validate(updateMedicationSchema),
  medicationController.update
);

module.exports = router;
