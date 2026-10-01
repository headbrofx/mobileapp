'use strict';

const { User } = require('../models');
const { notify } = require('./notification.service');
const messaging = require('../integrations/messaging');
const logger = require('../config/logger');

// One place a Care Mobility event becomes a message.
//
// The in-app notification is written first and is the one that is
// guaranteed. The outbound channels (push, SMS, WhatsApp) are then
// offered the same event and each declines until it is connected; see
// integrations/messaging. Neither may break the action that raised the
// event.
//
// Titles and messages carry no clinical detail. They may end up on a
// lock screen.
async function toUser(userId, { title, message, data = {}, event }) {
  await notify({ userId, type: 'BOOKING', title, message, data: { ...data, event } });
  messaging
    .dispatch({ userId, title, message, event, data })
    .catch((err) => logger.error('Messaging dispatch threw', { event, message: err.message }));
}

async function toDesk({ title, message, data = {}, event }) {
  const admins = await User.findAll({ where: { role: 'ADMIN', status: 'ACTIVE' }, attributes: ['id'] });
  await Promise.all(admins.map((a) => toUser(a.id, { title, message, data, event })));
}

module.exports = { toUser, toDesk };
