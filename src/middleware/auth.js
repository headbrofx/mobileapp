'use strict';

const { verifyAccessToken } = require('../services/token.service');
const { User } = require('../models');
const AppError = require('../utils/appError');

// Verifies the JWT and attaches the authenticated user to req.user.
// Downstream RBAC (requireRole) relies on req.user.role being set here.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('Missing or malformed Authorization header');
    }

    const payload = verifyAccessToken(token);
    const user = await User.findByPk(payload.sub);

    if (!user) {
      throw AppError.unauthorized('User no longer exists');
    }
    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Account suspended');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based access control guard. Usage: requireRole('ADMIN', 'STAFF')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
