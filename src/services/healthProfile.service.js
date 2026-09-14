'use strict';

const { HealthProfile } = require('../models');

async function getOrCreate(familyMemberId) {
  const [profile] = await HealthProfile.findOrCreate({
    where: { familyMemberId },
    defaults: { familyMemberId },
  });
  return profile;
}

async function update(familyMemberId, data) {
  const profile = await getOrCreate(familyMemberId);
  const fields = ['conditions', 'allergies', 'medications', 'medicalHistory', 'bloodType', 'heightCm', 'notes'];
  fields.forEach((field) => {
    if (data[field] !== undefined) profile[field] = data[field];
  });
  await profile.save();
  return profile;
}

module.exports = { getOrCreate, update };
