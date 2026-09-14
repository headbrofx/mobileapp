'use strict';

const { z } = require('zod');

const createFamilyMemberSchema = z.object({
  name: z.string().min(2).max(120),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDPARENT', 'OTHER']),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  permissions: z.record(z.boolean()).optional(),
});

const updateFamilyMemberSchema = createFamilyMemberSchema.partial();

module.exports = { createFamilyMemberSchema, updateFamilyMemberSchema };
