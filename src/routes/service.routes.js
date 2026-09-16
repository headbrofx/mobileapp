'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { Service } = require('../models');
const { success } = require('../utils/apiResponse');

const router = Router();

// The service catalogue. A booking needs a serviceId, and until this
// existed there was no way for a client to find one — the seeded
// services were reachable only by reading the database. A gap that only
// showed itself once something tried to be a client.
//
// Inactive services are hidden: a service withdrawn from sale should
// stop appearing, without deleting the bookings that reference it.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });
    return success(res, { message: 'Services', data: { services } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
