'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createCategorySchema,
  createContentSchema,
  updateContentSchema,
} = require('../validators/content.validator');
const controller = require('../controllers/content.controller');

const router = Router();

// Categories first, so "categories" is not read as a slug.
router.get('/categories', authenticate, controller.listCategories);
router.post(
  '/categories',
  authenticate,
  requireRole('ADMIN'),
  validate(createCategorySchema),
  controller.createCategory
);

router.get('/', authenticate, controller.list);
router.post('/', authenticate, requireRole('ADMIN'), validate(createContentSchema), controller.create);

// Publishing is its own act, separate from editing.
router.post('/:id/publish', authenticate, requireRole('ADMIN'), controller.publish);
router.post('/:id/unpublish', authenticate, requireRole('ADMIN'), controller.unpublish);
router.patch('/:id', authenticate, requireRole('ADMIN'), validate(updateContentSchema), controller.update);

// Last, so it cannot swallow any of the paths above.
router.get('/:slug', authenticate, controller.getBySlug);

module.exports = router;
