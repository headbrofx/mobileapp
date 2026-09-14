'use strict';

const { Op } = require('sequelize');
const { User, Staff, ClientProfile, FamilyMember, PasswordResetToken, VerificationCode } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { sha256, randomToken } = require('../utils/hash');
const { generateOtp } = require('../utils/otp');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const { logAudit } = require('./audit.service');
const AppError = require('../utils/appError');
const config = require('../config/env');
const logger = require('../config/logger');

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VERIFICATION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;

// Issues an access token + a brand-new refresh session, returns both
// tokens plus the session id (client doesn't need sid, but useful for logs).
async function issueTokenPair(user, req) {
  const session = await sessionService.createSession(user, req);
  return {
    accessToken: tokenService.signAccessToken(user),
    refreshToken: tokenService.signRefreshToken(user, session.id),
    tokenType: 'Bearer',
    expiresIn: config.jwt.accessExpiresIn,
  };
}

async function sendVerificationCode(user, channel) {
  const code = generateOtp();
  await VerificationCode.create({
    userId: user.id,
    channel,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  });

  // No SMS/email gateway wired up yet (later-phase integration work).
  // For now: log it, and — outside production — hand it back in the API
  // response so the flow is testable end to end.
  logger.info('Verification code generated', { userId: user.id, channel, code });
  return config.isProduction ? null : code;
}

async function register({ name, phone, email, password, role, specialty }, req) {
  const existing = await User.findOne({
    where: { [Op.or]: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing) {
    throw AppError.conflict('An account with this phone or email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    phone,
    email,
    passwordHash,
    role: role || 'CLIENT',
    status: 'PENDING_VERIFICATION',
  });

  if (user.role === 'STAFF') {
    await Staff.create({
      userId: user.id,
      specialty: specialty || 'NURSE',
      approvalStatus: 'PENDING',
    });
  }

  if (user.role === 'CLIENT') {
    // Every client gets a ClientProfile and a "SELF" FamilyMember
    // automatically — their own health record is usable immediately,
    // with no separate "create my patient profile" step.
    const clientProfile = await ClientProfile.create({ userId: user.id });
    await FamilyMember.create({
      clientProfileId: clientProfile.id,
      name: user.name,
      relationship: 'SELF',
      isPrimaryAccountHolder: true,
    });
  }

  const devOnlyCode = await sendVerificationCode(user, 'PHONE');
  const tokens = await issueTokenPair(user, req);

  await logAudit({ userId: user.id, action: 'REGISTER', req, metadata: { role: user.role } });

  return {
    user: user.toSafeJSON(),
    tokens,
    verification: { channel: 'PHONE', devOnlyCode }, // devOnlyCode is null in production
  };
}

async function login({ identifier, password }, req) {
  const user = await User.findOne({
    where: { [Op.or]: [{ phone: identifier }, { email: identifier }] },
  });
  if (!user) {
    await logAudit({ action: 'LOGIN_FAILED', req, metadata: { identifier, reason: 'not_found' } });
    throw AppError.unauthorized('Invalid credentials');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await logAudit({ userId: user.id, action: 'LOGIN_FAILED', req, metadata: { reason: 'bad_password' } });
    throw AppError.unauthorized('Invalid credentials');
  }
  if (user.status === 'SUSPENDED') {
    await logAudit({ userId: user.id, action: 'LOGIN_FAILED', req, metadata: { reason: 'suspended' } });
    throw AppError.forbidden('Account suspended');
  }

  const tokens = await issueTokenPair(user, req);
  await logAudit({ userId: user.id, action: 'LOGIN_SUCCESS', req });

  return { user: user.toSafeJSON(), tokens };
}

// Refresh-token rotation: every refresh invalidates the token just used
// and issues a new one in the same family. If an already-revoked token
// is presented again, that's a reuse signal — the whole family is killed
// and the caller must log in again.
async function refresh({ refreshToken }, req) {
  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch (err) {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const session = await sessionService.findActiveSession(payload.sid);

  if (!session) {
    // Either genuinely expired/unknown, or (if it exists but is revoked)
    // a reused token — either way, no valid session to continue from.
    const maybeRevoked = await require('../models').RefreshTokenSession.findByPk(payload.sid);
    if (maybeRevoked && maybeRevoked.revoked) {
      await sessionService.revokeFamily(maybeRevoked.familyId);
      await logAudit({
        userId: payload.sub,
        action: 'TOKEN_REUSE_DETECTED',
        req,
        metadata: { familyId: maybeRevoked.familyId },
      });
    }
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) {
    throw AppError.unauthorized('User no longer exists');
  }

  await sessionService.revokeSession(session);
  const newSession = await sessionService.createSessionInFamily(user, session.familyId, req);

  await logAudit({ userId: user.id, action: 'TOKEN_REFRESHED', req });

  return {
    tokens: {
      accessToken: tokenService.signAccessToken(user),
      refreshToken: tokenService.signRefreshToken(user, newSession.id),
      tokenType: 'Bearer',
      expiresIn: config.jwt.accessExpiresIn,
    },
  };
}

async function logout({ refreshToken }, req) {
  try {
    const payload = tokenService.verifyRefreshToken(refreshToken);
    const session = await sessionService.findActiveSession(payload.sid);
    if (session && session.userId === req.user.id) {
      await sessionService.revokeSession(session);
    }
  } catch (err) {
    // Already invalid/expired — logging out is a no-op success either way.
  }
  await logAudit({ userId: req.user.id, action: 'LOGOUT', req });
}

async function logoutAll(req) {
  await sessionService.revokeAllForUser(req.user.id);
  await logAudit({ userId: req.user.id, action: 'LOGOUT_ALL', req });
}

async function listSessions(req) {
  const sessions = await sessionService.listActiveSessions(req.user.id);
  return sessions.map((s) => ({
    id: s.id,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }));
}

async function revokeSessionById(req, sessionId) {
  const session = await require('../models').RefreshTokenSession.findByPk(sessionId);
  if (!session || session.userId !== req.user.id) {
    throw AppError.notFound('Session not found');
  }
  await sessionService.revokeSession(session);
  await logAudit({ userId: req.user.id, action: 'SESSION_REVOKED', req, entityType: 'RefreshTokenSession', entityId: sessionId });
}

// Always responds the same way whether or not the account exists, to
// avoid leaking which phone/email numbers are registered.
async function forgotPassword({ identifier }, req) {
  const user = await User.findOne({
    where: { [Op.or]: [{ phone: identifier }, { email: identifier }] },
  });

  if (user) {
    const rawToken = randomToken();
    await PasswordResetToken.create({
      userId: user.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    logger.info('Password reset token generated', { userId: user.id, rawToken });
    await logAudit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', req });

    return { devOnlyToken: config.isProduction ? null : rawToken };
  }

  return { devOnlyToken: null };
}

async function resetPassword({ token, newPassword }, req) {
  const tokenHash = sha256(token);
  const resetToken = await PasswordResetToken.findOne({ where: { tokenHash, usedAt: null } });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw AppError.badRequest('Invalid or expired reset token');
  }

  const user = await User.findByPk(resetToken.userId);
  if (!user) {
    throw AppError.badRequest('Invalid or expired reset token');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  // Force re-login everywhere — a password reset should invalidate every
  // existing session, in case the old password was compromised.
  await sessionService.revokeAllForUser(user.id);

  await logAudit({ userId: user.id, action: 'PASSWORD_RESET_COMPLETED', req });
}

async function requestVerification(req, { channel }) {
  const devOnlyCode = await sendVerificationCode(req.user, channel);
  await logAudit({ userId: req.user.id, action: 'VERIFICATION_REQUESTED', req, metadata: { channel } });
  return { devOnlyCode };
}

async function confirmVerification(req, { channel, code }) {
  const record = await VerificationCode.findOne({
    where: { userId: req.user.id, channel, verifiedAt: null },
    order: [['createdAt', 'DESC']],
  });

  if (!record || record.expiresAt < new Date()) {
    throw AppError.badRequest('No pending verification code — request a new one');
  }
  if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw AppError.badRequest('Too many attempts — request a new code');
  }

  if (record.codeHash !== sha256(code)) {
    record.attempts += 1;
    await record.save();
    await logAudit({ userId: req.user.id, action: 'VERIFICATION_FAILED', req, metadata: { channel } });
    throw AppError.badRequest('Incorrect code');
  }

  record.verifiedAt = new Date();
  await record.save();

  if (req.user.status === 'PENDING_VERIFICATION') {
    req.user.status = 'ACTIVE';
    await req.user.save();
  }

  await logAudit({ userId: req.user.id, action: 'VERIFICATION_CONFIRMED', req, metadata: { channel } });

  return { user: req.user.toSafeJSON() };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSessionById,
  forgotPassword,
  resetPassword,
  requestVerification,
  confirmVerification,
};
