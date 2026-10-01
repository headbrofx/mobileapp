'use strict';

// Payment readiness. No gateway is connected, and nothing here ever
// reports a payment that did not happen.
//
// Today money moves off the app (cash to the nurse, M-Pesa to the
// business number) and staff record it against the invoice. When a
// gateway is signed (Selcom, AzamPay, DPO, a mobile-money aggregator),
// fill in initiate() and verify(), set its keys in the environment,
// and point its callback at a route that calls verify() before marking
// anything paid. A callback is never trusted on its own word.
//
//   PAYMENT_PROVIDER=<name>   PAYMENT_API_KEY=...   PAYMENT_WEBHOOK_SECRET=...

function configured() {
  return Boolean(process.env.PAYMENT_PROVIDER && process.env.PAYMENT_API_KEY);
}

function describe() {
  return {
    online: configured(),
    provider: configured() ? process.env.PAYMENT_PROVIDER : null,
    // What the client is told to do instead.
    offlineMethods: ['CASH', 'MPESA', 'TIGOPESA', 'AIRTELMONEY', 'HALOPESA', 'BANK'],
  };
}

async function initiate() {
  if (!configured()) return { status: 'NOT_CONFIGURED' };
  // TODO(payments): create a charge with the provider and return
  // { status: 'PENDING', providerReference, checkoutUrl? }. Never 'PAID'
  // here: a charge is paid when verify() says so.
  return { status: 'NOT_IMPLEMENTED' };
}

async function verify() {
  if (!configured()) return { status: 'NOT_CONFIGURED' };
  // TODO(payments): ask the provider for the charge's real state.
  return { status: 'NOT_IMPLEMENTED' };
}

module.exports = { describe, initiate, verify };
