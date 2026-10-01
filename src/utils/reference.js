'use strict';

const crypto = require('crypto');

// A reference a person can read down a phone line: "AN-7KQ4MX".
//
// No 0/O, 1/I/L, so nobody has to ask which one it was. Six characters
// from 31 is about 887 million combinations, and the column is unique,
// so the rare collision is a failed insert that the caller retries,
// never two requests sharing a number.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const PREFIX = {
  BOOKING: 'AN',
  TRANSPORT: 'AT',
};

function generateReference(kind = 'BOOKING') {
  let body = '';
  for (let i = 0; i < 6; i += 1) {
    body += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${PREFIX[kind] || PREFIX.BOOKING}-${body}`;
}

function isReferenceCollision(err) {
  return (
    err?.name === 'SequelizeUniqueConstraintError' &&
    (err.errors || []).some((e) => e.path === 'booking_reference' || e.path === 'bookingReference')
  );
}

module.exports = { generateReference, isReferenceCollision, ALPHABET };
