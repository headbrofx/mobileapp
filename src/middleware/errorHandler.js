'use strict';

const logger = require('../config/logger');
const { error } = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const { isProduction } = require('../config/env');

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Sequelize validation/unique-constraint errors get mapped to clean 4xx
// responses instead of leaking a 500 with a raw SQL error.
function normalizeError(err) {
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors?.map((e) => ({ field: e.path, message: e.message }));
    return AppError.badRequest('Validation failed', errors);
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return AppError.unauthorized('Invalid or expired token');
  }
  // e.g. a malformed UUID in a route param (":id") hitting Postgres.
  if (err.name === 'SequelizeDatabaseError' && /invalid input syntax/i.test(err.message)) {
    return AppError.badRequest('Invalid identifier in request');
  }
  return err;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode || 500;
  const isOperational = normalized.isOperational === true;

  if (!isOperational) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack });
  } else if (statusCode >= 500) {
    logger.error(normalized.message, { code: normalized.code });
  }

  return error(res, {
    statusCode,
    message: isOperational ? normalized.message : 'Internal server error',
    code: normalized.code || 'INTERNAL_ERROR',
    errors: normalized.errors,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };
