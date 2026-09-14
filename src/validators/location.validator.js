'use strict';

const { z } = require('zod');

const createLocationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  recordedAt: z.string().datetime().optional(),
});

module.exports = { createLocationPingSchema };
