'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/symptomCatalog.controller');

const router = Router();

// Reference data — any authenticated user can browse it (used client-side
// to suggest structured symptom names/triggers when logging one).
router.get('/', authenticate, controller.list);

module.exports = router;
