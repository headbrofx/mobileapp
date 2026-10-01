'use strict';

// Outbound messages beyond the in-app bell: push, SMS, WhatsApp.
//
// None is connected. The in-app notification (notification.service) is
// the one channel that really delivers, and it is always written first.
// These are called after it with the same event, and each answers
// NOT_CONFIGURED until its credentials are set, so connecting one later
// is a matter of filling in its function, not finding every place an
// event is raised.
//
//   push      EXPO_ACCESS_TOKEN            (Expo push service)
//   sms       SMS_PROVIDER, SMS_API_KEY, SMS_SENDER_ID
//   whatsapp  WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//
// Message text must never carry clinical detail: "Muuguzi yupo njiani",
// not why she is coming. An SMS sits on a lock screen.

const logger = require('../../config/logger');

const CHANNELS = {
  push: {
    configured: () => Boolean(process.env.EXPO_ACCESS_TOKEN),
    // TODO(push): look up the user's Expo push tokens and POST to
    // https://exp.host/--/api/v2/push/send. There is no push-token
    // table yet; registering one from the app comes first.
    send: async () => ({ status: 'NOT_IMPLEMENTED' }),
  },
  sms: {
    configured: () => Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY),
    // TODO(sms): call the gateway (e.g. Beem, Africa's Talking) with
    // SMS_SENDER_ID as the sender.
    send: async () => ({ status: 'NOT_IMPLEMENTED' }),
  },
  whatsapp: {
    configured: () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    // TODO(whatsapp): Cloud API template message. Free text outside a
    // 24-hour customer window is not allowed, so this needs approved
    // templates per event.
    send: async () => ({ status: 'NOT_IMPLEMENTED' }),
  },
};

function describe() {
  return Object.fromEntries(Object.entries(CHANNELS).map(([k, c]) => [k, { configured: c.configured() }]));
}

// Fire-and-forget fan-out. Never throws into the caller.
async function dispatch(event) {
  const results = {};
  for (const [name, channel] of Object.entries(CHANNELS)) {
    if (!channel.configured()) {
      results[name] = 'NOT_CONFIGURED';
      continue;
    }
    try {
      const r = await channel.send(event);
      results[name] = r.status;
    } catch (err) {
      logger.error('Messaging channel failed', { channel: name, message: err.message });
      results[name] = 'FAILED';
    }
  }
  return results;
}

module.exports = { describe, dispatch };
