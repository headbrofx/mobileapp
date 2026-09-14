'use strict';

const { z } = require('zod');

const updateMyStaffProfileSchema = z.object({
  bio: z.string().max(2000).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  licenseNumber: z.string().max(100).optional(),
  serviceAreas: z.array(z.string().min(1).max(100)).max(30).optional(),
  availability: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
});

module.exports = { updateMyStaffProfileSchema };
