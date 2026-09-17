'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const service = require('../services/notification.service');
const { success } = require('../utils/apiResponse');

const router = Router();

// Everything here is scoped to the signed-in user by the service, which
// takes req.user.id rather than an id from the request — there is no
// way to ask for somebody else's notifications.

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [notifications, unread] = await Promise.all([
      service.list(req.user.id, { unreadOnly: req.query.unread === 'true' }),
      service.unreadCount(req.user.id),
    ]);
    return success(res, { message: 'Notifications', data: { notifications, unread } });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    const count = await service.markAllRead(req.user.id);
    return success(res, { message: 'Marked as read', data: { count } });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await service.markRead(req.user.id, req.params.id);
    return success(res, { message: 'Marked as read', data: { notification } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
