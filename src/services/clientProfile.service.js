'use strict';

const { ClientProfile } = require('../models');

// The client's own details: where they live, and who to call if
// something goes wrong during a visit.
//
// Registration creates the row, but nothing until now could write to
// it, so every booking asked for the address again from scratch. A
// client who has told us where they live once should not have to type
// it a third time.

async function getOrCreate(userId) {
  const [profile] = await ClientProfile.findOrCreate({
    where: { userId },
    defaults: { userId },
  });
  return profile;
}

const FIELDS = [
  'address',
  'city',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelationship',
];

async function update(userId, data) {
  const profile = await getOrCreate(userId);
  FIELDS.forEach((field) => {
    if (data[field] !== undefined) profile[field] = data[field];
  });
  await profile.save();
  return profile;
}

module.exports = { getOrCreate, update };
