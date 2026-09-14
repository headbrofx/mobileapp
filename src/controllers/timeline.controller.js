'use strict';

const { buildTimeline } = require('../services/timeline.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const events = await buildTimeline(req.familyMember.id, req.query);
    return success(res, { message: 'Health timeline', data: { events } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
