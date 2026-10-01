'use strict';

const crypto = require('crypto');
const partners = require('../integrations/transport');
const transport = require('../services/transport.service');
const { logAudit } = require('../services/audit.service');
const { success, error } = require('../utils/apiResponse');
const logger = require('../config/logger');

// POST /api/integrations/transport/webhook
//
// Where a transport company tells us a trip moved. Nobody can call it
// until both a partner adapter and a shared secret are configured:
//
//   no secret set            503 NOT_CONFIGURED
//   missing/wrong signature  401
//   signed, but no adapter   503 NOT_CONFIGURED
//
// The signature is HMAC-SHA256 of the raw request body under
// TRANSPORT_WEBHOOK_SECRET, hex, in X-Signature (optionally prefixed
// "sha256="). Compared in constant time.
//
// A valid callback that names an unknown trip, or a status that is not
// a legal next step, is acknowledged with 200 and applied: false, so
// the partner does not retry it forever; the reason is audited.
function verify(req, secret) {
  const header = String(req.get('X-Signature') || '').replace(/^sha256=/, '');
  if (!header || !req.rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function receive(req, res, next) {
  try {
    const secret = process.env.TRANSPORT_WEBHOOK_SECRET;
    if (!secret) {
      return error(res, { statusCode: 503, code: 'NOT_CONFIGURED', message: 'Transport partner webhook is not configured' });
    }
    if (!verify(req, secret)) {
      await logAudit({ action: 'TRANSPORT_WEBHOOK_REJECTED', req, metadata: { reason: 'BAD_SIGNATURE' } });
      return error(res, { statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid signature' });
    }

    const adapter = partners.active();
    if (!adapter.isConfigured()) {
      return error(res, { statusCode: 503, code: 'NOT_CONFIGURED', message: 'No transport partner adapter is configured' });
    }

    let update;
    try {
      update = adapter.parseWebhook(req.body);
    } catch (err) {
      logger.error('Transport webhook parse failed', { message: err.message });
      return error(res, { statusCode: 400, code: 'BAD_REQUEST', message: 'Could not read the callback' });
    }

    const result = await transport.applyPartnerUpdate(update);
    await logAudit({
      action: 'TRANSPORT_WEBHOOK_RECEIVED',
      entityType: 'TransportRequest',
      entityId: result.tripId || null,
      req,
      metadata: { partnerReference: update.partnerReference, tripStatus: update.tripStatus, ...result },
    });
    return success(res, { message: 'Received', data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { receive, verify };
