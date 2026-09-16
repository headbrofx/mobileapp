'use strict';

const service = require('../services/analytics.service');
const { success } = require('../utils/apiResponse');

async function overview(req, res, next) {
  try {
    const days = req.query.days ? Math.min(Number(req.query.days), 365) : 30;
    const data = await service.overview({ days });
    return success(res, { message: 'Analytics', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { overview };
