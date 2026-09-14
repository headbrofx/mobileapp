'use strict';

const service = require('../services/symptomCatalog.service');
const { success } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const items = await service.list({ category: req.query.category });
    return success(res, { message: 'Symptom catalogue', data: { items } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
