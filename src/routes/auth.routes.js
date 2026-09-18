'use strict';

const { Router } = require('express');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  googleSignInSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyRequestSchema,
  verifyConfirmSchema,
} = require('../validators/auth.validator');
const controller = require('../controllers/auth.controller');

const router = Router();

// --- Sign up / sign in ---
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post(
  '/google',
  authLimiter,
  validate(googleSignInSchema),
  controller.googleSignIn
);
router.post('/refresh', authLimiter, validate(refreshSchema), controller.refresh);
router.get('/me', authenticate, controller.me);

// --- Logout / session management ---
router.post('/logout', authenticate, validate(refreshSchema), controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);
router.get('/sessions', authenticate, controller.listSessions);
router.delete('/sessions/:id', authenticate, controller.revokeSession);

// --- Password reset ---
router.post('/password/forgot', authLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/password/reset', authLimiter, validate(resetPasswordSchema), controller.resetPassword);

// --- Phone/email verification ---
router.post('/verify/request', authenticate, authLimiter, validate(verifyRequestSchema), controller.requestVerification);
router.post('/verify/confirm', authenticate, authLimiter, validate(verifyConfirmSchema), controller.confirmVerification);

module.exports = router;
