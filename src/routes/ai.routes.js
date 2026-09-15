'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { askSchema, createKnowledgeSchema, reviewSchema } = require('../validators/ai.validator');
const controller = require('../controllers/ai.controller');

const router = Router();

// --- Asking ---
router.post('/ask', authenticate, validate(askSchema), controller.ask);
router.get('/history', authenticate, controller.history);

// --- Knowledge base ---
// Anyone signed in can read what the AI is allowed to answer from;
// only an admin can add to it or sign it off.
router.get('/knowledge', authenticate, controller.listKnowledge);
router.post('/knowledge', authenticate, requireRole('ADMIN'), validate(createKnowledgeSchema), controller.createKnowledge);
router.post('/knowledge/:id/verify', authenticate, requireRole('ADMIN'), controller.verifyKnowledge);

// --- Human review ---
router.get('/review', authenticate, requireRole('ADMIN'), controller.reviewQueue);
router.post('/review/:id', authenticate, requireRole('ADMIN'), validate(reviewSchema), controller.review);

module.exports = router;
