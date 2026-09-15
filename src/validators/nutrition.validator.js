'use strict';

const { z } = require('zod');

const updateNutritionProfileSchema = z.object({
  goal: z.enum(['WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MANAGE_CONDITION', 'GENERAL_HEALTH']).optional(),
  // Set deliberately or not at all. Nothing in this codebase calculates
  // one — see the note at the top of nutrition.service.js. The bounds
  // are a sanity check against a typo, not a recommendation.
  dailyCalorieTarget: z.number().int().min(800).max(6000).nullable().optional(),
  dailyWaterTargetMl: z.number().int().min(250).max(10000).optional(),
  dietaryPreferences: z.array(z.string().max(60)).max(20).optional(),
  restrictions: z.array(z.string().max(60)).max(20).optional(),
});

const mealItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().max(50).optional(),
  // Only used when the catalogue does not know the food. A supplied
  // figure is never overridden, and never invented.
  calories: z.number().int().min(0).max(5000).optional(),
});

const logMealSchema = z.object({
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  items: z.array(mealItemSchema).min(1).max(30),
  loggedAt: z.string().datetime().optional(),
});

const logWaterSchema = z.object({
  amountMl: z.number().int().positive().max(5000),
  loggedAt: z.string().datetime().optional(),
});

module.exports = { updateNutritionProfileSchema, logMealSchema, logWaterSchema };
