'use strict';

const { randomUUID } = require('crypto');
const { RefreshTokenSession } = require('../models');
const config = require('../config/env');

// Parses "15m" / "30d" / "1h" style durations (subset of the ms library,
// just what JWT_*_EXPIRES_IN uses) into milliseconds.
function parseDurationMs(input) {
  const match = /^(\d+)([smhd])$/.exec(input);
  if (!match) return 15 * 60 * 1000; // sane fallback
  const value = parseInt(match[1], 10);
  const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[match[2]];
  return value * unitMs;
}

// Creates a brand-new session (new rotation family) — used on login/register.
async function createSession(user, req) {
  const familyId = randomUUID();
  return createSessionInFamily(user, familyId, req);
}

async function createSessionInFamily(user, familyId, req) {
  const expiresAt = new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn));
  return RefreshTokenSession.create({
    userId: user.id,
    familyId,
    userAgent: req?.headers?.['user-agent'] || null,
    ipAddress: req?.ip || null,
    expiresAt,
  });
}

async function findActiveSession(sessionId) {
  const session = await RefreshTokenSession.findByPk(sessionId);
  if (!session) return null;
  if (session.revoked) return null;
  if (session.expiresAt < new Date()) return null;
  return session;
}

async function revokeSession(session) {
  session.revoked = true;
  session.revokedAt = new Date();
  await session.save();
}

// Revokes every session sharing a rotation family — used when token reuse
// is detected (a revoked refresh token is presented again), which signals
// the token may have been stolen.
async function revokeFamily(familyId) {
  await RefreshTokenSession.update(
    { revoked: true, revokedAt: new Date() },
    { where: { familyId, revoked: false } }
  );
}

async function revokeAllForUser(userId) {
  await RefreshTokenSession.update(
    { revoked: true, revokedAt: new Date() },
    { where: { userId, revoked: false } }
  );
}

async function listActiveSessions(userId) {
  return RefreshTokenSession.findAll({
    where: { userId, revoked: false },
    order: [['createdAt', 'DESC']],
  });
}

module.exports = {
  createSession,
  createSessionInFamily,
  findActiveSession,
  revokeSession,
  revokeFamily,
  revokeAllForUser,
  listActiveSessions,
};
