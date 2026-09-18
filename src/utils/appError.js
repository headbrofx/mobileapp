'use strict';

// Operational errors we throw on purpose (bad input, unauthorized, not
// found, ...) — as opposed to bugs. The error handler treats these two
// classes differently: operational errors return their own message to
// the client, unexpected ones return a generic message and get logged.
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = null) {
    return new AppError(message, 400, 'BAD_REQUEST', errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  // Takes an optional code and payload, because some conflicts are a
  // step in a flow rather than a dead end — Google sign-in returns one
  // saying which detail is still missing, and the app needs to tell
  // that apart from an ordinary clash.
  static conflict(message = 'Conflict', code = 'CONFLICT', errors = null) {
    return new AppError(message, 409, code, errors);
  }
}

module.exports = AppError;
