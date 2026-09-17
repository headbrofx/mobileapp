'use strict';

const { Op } = require('sequelize');
const { Notification } = require('../models');
const AppError = require('../utils/appError');
const logger = require('../config/logger');

// In-app notifications.
//
// The table has existed since Phase 1 with nothing writing to or
// reading from it. This makes it real: bookings now leave a trail a
// client can see, which is what the bell in the design is counting.
//
// Nothing is pushed anywhere. There is no SMS gateway and no push
// credential, so a notification is a row the app reads when it opens —
// the same honesty the medication reminders keep.

// Writing a notification must never break the thing that triggered it.
// A booking that succeeded and then failed to notify is still a booking
// that succeeded.
async function notify({ userId, type = 'SYSTEM', title, message, data = {} }) {
  try {
    return await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      status: 'SENT',
      sentAt: new Date(),
    });
  } catch (err) {
    logger.error('Failed to write notification', { userId, type, message: err.message });
    return null;
  }
}

async function list(userId, { unreadOnly = false, limit = 50 } = {}) {
  const where = { userId };
  if (unreadOnly) where.status = { [Op.ne]: 'READ' };

  return Notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
  });
}

async function unreadCount(userId) {
  return Notification.count({ where: { userId, status: { [Op.ne]: 'READ' } } });
}

async function markRead(userId, id) {
  const notification = await Notification.findOne({ where: { id, userId } });
  if (!notification) throw AppError.notFound('Notification not found');

  notification.status = 'READ';
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

async function markAllRead(userId) {
  const [count] = await Notification.update(
    { status: 'READ', readAt: new Date() },
    { where: { userId, status: { [Op.ne]: 'READ' } } }
  );
  return count;
}

module.exports = { notify, list, unreadCount, markRead, markAllRead };
