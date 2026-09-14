'use strict';

const crypto = require('crypto');

// One-way hash for opaque tokens (refresh-token lookup isn't needed here
// since we look up by session id, but password-reset tokens and OTP
// codes are matched by this hash so the raw value is never stored).
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { sha256, randomToken };
