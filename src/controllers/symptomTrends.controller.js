'use strict';

const { computeSymptomTrends } = require('../services/symptomTrends.service');
const { success } = require('../utils/apiResponse');

async function get(req, res, next) {
  try {
    const trends = await computeSymptomTrends(req.familyMember.id);
    return success(res, { message: 'Symptom trends', data: { trends } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
