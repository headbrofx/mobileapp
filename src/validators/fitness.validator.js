'use strict';

const { z } = require('zod');

const updateFitnessProfileSchema = z.object({
  goal: z.enum(['WEIGHT_LOSS', 'MUSCLE_GAIN', 'ENDURANCE', 'GENERAL_FITNESS', 'REHAB']).optional(),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
});

const logWorkoutSchema = z.object({
  exerciseType: z.string().min(2).max(80),
  durationMinutes: z.number().int().positive().max(600),
  intensity: z.enum(['LOW', 'MODERATE', 'HIGH']).optional().default('MODERATE'),
  // Accepted when the user knows it, never worked out on their behalf —
  // see the note at the top of fitness.service.js.
  caloriesBurned: z.number().int().min(0).max(5000).optional(),
  notes: z.string().max(2000).optional(),
  loggedAt: z.string().datetime().optional(),
});

const upsertActivitySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
      .refine((value) => Date.parse(value) <= Date.now(), 'That date is in the future'),
    steps: z.number().int().min(0).max(200000).optional(),
    distanceKm: z.number().min(0).max(500).optional(),
    activeMinutes: z.number().int().min(0).max(1440).optional(),
  })
  .refine(
    (value) => value.steps != null || value.distanceKm != null || value.activeMinutes != null,
    'Give at least one of steps, distanceKm or activeMinutes'
  );

module.exports = { updateFitnessProfileSchema, logWorkoutSchema, upsertActivitySchema };
