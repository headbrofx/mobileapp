'use strict';

// Standard API response envelope used across every endpoint so client
// apps (Flutter client + nurse app) only need to handle one shape.

function success(res, { statusCode = 200, message = 'OK', data = null, meta = null } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function error(res, { statusCode = 500, message = 'Something went wrong', code = 'INTERNAL_ERROR', errors = null } = {}) {
  const body = { success: false, message, code };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
