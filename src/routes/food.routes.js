'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/nutrition.controller');

const router = Router();

// Reference data, so it is not scoped to a family member. Any signed-in
// user can browse or search it when logging a meal.
router.get('/', authenticate, controller.searchFoods);

module.exports = router;
