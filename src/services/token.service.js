'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

// The refresh token carries a session id (sid) pointing at a
// RefreshTokenSession row in the database — the DB row is the source of
// truth for revocation, the JWT signature just proves authenticity.
function signRefreshToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
