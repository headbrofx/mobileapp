'use strict';

const { z } = require('zod');

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date')
  // A period cannot have started tomorrow. Catching it here keeps
  // nonsense out of the averages the prediction is built from.
  .refine((value) => Date.parse(value) <= Date.now(), 'That date is in the future');

const createCycleSchema = z.object({
  cycleStartDate: dateOnly,
  cycleEndDate: dateOnly.optional(),
  flow: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
  symptoms: z.array(z.string().max(60)).max(20).optional(),
  mood: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
});

const updateCycleSchema = createCycleSchema.partial();

// --- Daily check-in ---
//
// Every field optional, including all of them at once: somebody who
// opens the check-in, ticks nothing and saves has still told Orbit that
// today was unremarkable, and a row of nulls records that honestly.
// The floors differ on purpose — pain starts at 0 because "no pain" is
// an answer, the rest start at 1 because there is no such thing as
// zero mood.
const scale = z.number().int().min(1).max(5);

const checkinSchema = z.object({
  // Defaults to today in the service. Accepted here so a person can
  // fill in yesterday, which is when most people remember.
  checkinDate: dateOnly.optional(),
  mood: scale.nullable().optional(),
  energy: scale.nullable().optional(),
  sleep: scale.nullable().optional(),
  appetite: scale.nullable().optional(),
  pain: z.number().int().min(0).max(5).nullable().optional(),
  flow: z.enum(['NONE', 'SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY']).nullable().optional(),
  symptoms: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

module.exports = { createCycleSchema, updateCycleSchema, checkinSchema };
