'use strict';

const { FamilyMember, ClientProfile } = require('../models');
const AppError = require('../utils/appError');

async function createFamilyMember(userId, data) {
  const clientProfile = await ClientProfile.findOne({ where: { userId } });
  if (!clientProfile) {
    throw AppError.badRequest('Only client accounts can add family members');
  }

  return FamilyMember.create({
    clientProfileId: clientProfile.id,
    name: data.name,
    relationship: data.relationship,
    dateOfBirth: data.dateOfBirth || null,
    gender: data.gender || null,
    permissions: data.permissions || {},
  });
}

async function listFamilyMembers(userId) {
  const clientProfile = await ClientProfile.findOne({ where: { userId } });
  if (!clientProfile) return [];
  return FamilyMember.findAll({
    where: { clientProfileId: clientProfile.id },
    order: [['isPrimaryAccountHolder', 'DESC'], ['createdAt', 'ASC']],
  });
}

async function updateFamilyMember(familyMember, data) {
  const fields = ['name', 'relationship', 'dateOfBirth', 'gender', 'permissions'];
  fields.forEach((field) => {
    if (data[field] !== undefined) familyMember[field] = data[field];
  });
  await familyMember.save();
  return familyMember;
}

module.exports = { createFamilyMember, listFamilyMembers, updateFamilyMember };
