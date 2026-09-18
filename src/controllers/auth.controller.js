'use strict';

const authService = require('../services/auth.service');
const { success } = require('../utils/apiResponse');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body, req);
    return success(res, { statusCode: 201, message: 'Account created', data: result });
  } catch (err) {
    next(err);
  }
}

async function googleSignIn(req, res, next) {
  try {
    const data = await authService.googleSignIn(req.body, req);
    return success(res, { message: 'Signed in with Google', data });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body, req);
    return success(res, { message: 'Logged in', data: result });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.body, req);
    return success(res, { message: 'Token refreshed', data: result });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.body, req);
    return success(res, { message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await authService.logoutAll(req);
    return success(res, { message: 'Logged out of all sessions' });
  } catch (err) {
    next(err);
  }
}

async function listSessions(req, res, next) {
  try {
    const sessions = await authService.listSessions(req);
    return success(res, { message: 'Active sessions', data: { sessions } });
  } catch (err) {
    next(err);
  }
}

async function revokeSession(req, res, next) {
  try {
    await authService.revokeSessionById(req, req.params.id);
    return success(res, { message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body, req);
    return success(res, {
      message: 'If that account exists, password reset instructions were sent',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body, req);
    return success(res, { message: 'Password has been reset. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

async function requestVerification(req, res, next) {
  try {
    const result = await authService.requestVerification(req, req.body);
    return success(res, { message: 'Verification code sent', data: result });
  } catch (err) {
    next(err);
  }
}

async function confirmVerification(req, res, next) {
  try {
    const result = await authService.confirmVerification(req, req.body);
    return success(res, { message: 'Verified', data: result });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    return success(res, { message: 'Current user', data: { user: req.user.toSafeJSON() } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  googleSignIn,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  requestVerification,
  confirmVerification,
  me,
};
