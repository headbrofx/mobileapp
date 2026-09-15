'use strict';

const { z } = require('zod');

const askSchema = z.object({
  question: z.string().min(3).max(2000),
  // Who the question is about. Omitted for questions about the service
  // itself rather than a person.
  familyMemberId: z.string().uuid().optional(),
});

const createKnowledgeSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  category: z.enum(['COMPANY_INFO', 'SERVICE_INFO', 'HEALTH_EDUCATION']),
  language: z.enum(['SW', 'EN']).optional().default('SW'),
  source: z.string().max(300).optional(),
});

const reviewSchema = z.object({
  status: z.enum(['REVIEWED_OK', 'FLAGGED_INCORRECT']),
  note: z.string().max(2000).optional(),
});

module.exports = { askSchema, createKnowledgeSchema, reviewSchema };
