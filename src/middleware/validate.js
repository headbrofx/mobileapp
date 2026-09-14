'use strict';

const AppError = require('../utils/appError');

// Validates req.body (or .query / .params) against a Zod schema.
// Usage: router.post('/x', validate(schema), controller)
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(AppError.badRequest('Validation failed', errors));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
