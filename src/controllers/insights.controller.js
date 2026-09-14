'use strict';

const { computeInsights } = require('../services/insights.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const insights = await computeInsights(req.familyMember.id);
    return success(res, { message: 'Health insights', data: insights });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
