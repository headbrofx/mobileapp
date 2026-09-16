'use strict';

const { z } = require('zod');

// Whole shillings only. A fractional shilling does not exist in
// circulation, and allowing one would invite floats into the books.
const shillings = z.number().int().min(0).max(1000000000);

const invoiceItemSchema = z.object({
  description: z.string().min(2).max(200),
  quantity: z.number().int().positive().max(1000).optional().default(1),
  unitPrice: shillings,
});

const createInvoiceSchema = z.object({
  clientProfileId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  items: z.array(invoiceItemSchema).min(1).max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD').optional(),
  notes: z.string().max(2000).optional(),
  // No total is accepted: it is computed from the lines. See the note
  // at the top of billing.service.js.
});

const recordPaymentSchema = z.object({
  amount: shillings.refine((value) => value > 0, 'A payment must be more than zero'),
  method: z.enum(['CASH', 'MPESA', 'TIGOPESA', 'AIRTELMONEY', 'HALOPESA', 'BANK', 'OTHER']),
  reference: z.string().max(120).optional(),
  paidAt: z.string().datetime().optional(),
  note: z.string().max(1000).optional(),
});

const cancelInvoiceSchema = z.object({
  reason: z.string().min(3).max(500),
});

module.exports = { createInvoiceSchema, recordPaymentSchema, cancelInvoiceSchema };
