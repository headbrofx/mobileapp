'use strict';

const { z } = require('zod');

// Accounts are suspended, never deleted: a deleted user takes their
// bookings, visit records and invoices with them, and a health business
// is obliged to keep those.
const setUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

const setUserRoleSchema = z.object({
  role: z.enum(['CLIENT', 'STAFF', 'ADMIN']),
});

module.exports = { setUserStatusSchema, setUserRoleSchema };
