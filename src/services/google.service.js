'use strict';

const { OAuth2Client } = require('google-auth-library');
const config = require('../config/env');
const AppError = require('../utils/appError');

// Verifying a Google ID token.
//
// The whole security of "sign in with Google" rests on two checks, and
// both happen inside verifyIdToken:
//
//   1. the token is really signed by Google, against Google's published
//      keys, and has not expired;
//   2. its audience is one of OUR client ids.
//
// The second is the one that is easy to leave out and fatal to skip.
// Without it, a token Google minted for any other application in the
// world would be accepted here, and anybody running such an app could
// sign in as any of its users. Decoding the token and trusting the
// email inside it — which is the shortcut that looks like it works —
// has exactly that hole.

const client = new OAuth2Client();

async function verifyIdToken(idToken) {
  if (config.googleClientIds.length === 0) {
    // Nothing to check the audience against, so there is no safe way to
    // accept this. Fail loudly rather than degrading to "trust it".
    throw AppError.badRequest('Google sign-in is not configured on this server');
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientIds,
    });
  } catch {
    throw AppError.unauthorized('Google sign-in failed');
  }

  const payload = ticket.getPayload();

  // Google says whether it has confirmed the address. An unverified one
  // must never be used to find an existing account, or somebody could
  // claim another person's by signing up to Google with their address.
  if (!payload?.email || !payload.email_verified) {
    throw AppError.unauthorized('Google account has no verified email address');
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
  };
}

module.exports = { verifyIdToken };
