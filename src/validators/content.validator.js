'use strict';

const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).optional(),
});

const createContentSchema = z.object({
  type: z.enum(['ARTICLE', 'PODCAST', 'NEWS']).optional().default('ARTICLE'),
  title: z.string().min(3).max(200),
  slug: z.string().min(2).max(120).optional(),
  body: z.string().optional(),
  audioUrl: z.string().url().max(500).optional(),
  transcript: z.string().optional(),
  sourceUrl: z.string().url().max(500).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  categoryId: z.string().uuid().optional(),
});

// status and publishedAt are moved by publish/unpublish, never by an
// ordinary edit, so they are not accepted here.
const updateContentSchema = createContentSchema.partial();

module.exports = { createCategorySchema, createContentSchema, updateContentSchema };
