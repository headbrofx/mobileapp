'use strict';

const crypto = require('crypto');

// 6-digit numeric OTP for phone/email verification.
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = { generateOtp };
