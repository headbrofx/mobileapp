'use strict';

// The adapter in use when no transport company is connected. Every
// answer is NOT_CONFIGURED, which the transport service reads as "the
// dispatcher does this by hand".
const NOT_CONFIGURED = Object.freeze({ status: 'NOT_CONFIGURED' });

module.exports = {
  isConfigured: () => false,
  name: () => null,
  requestQuote: async () => NOT_CONFIGURED,
  bookTrip: async () => NOT_CONFIGURED,
  cancelTrip: async () => NOT_CONFIGURED,
  getTripStatus: async () => NOT_CONFIGURED,
  parseWebhook: () => {
    throw new Error('No transport partner is configured');
  },
};
