'use strict';

const { Staff, User } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

async function listStaff({ status } = {}) {
  const where = status ? { approvalStatus: status } : {};
  const staff = await Staff.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email', 'status'] }],
    order: [['createdAt', 'DESC']],
  });
  return staff;
}

async function getMyProfile(userId) {
  const staff = await Staff.findOne({ where: { userId } });
  if (!staff) {
    throw AppError.notFound('Staff profile not found');
  }
  return staff;
}

// Self-service profile/availability update — the "staff-side" endpoint
// Phase 5 deliberately deferred (it hardcoded availability/serviceAreas
// via the model when setting up test fixtures).
async function updateMyProfile(userId, data, req) {
  const staff = await Staff.findOne({ where: { userId } });
  if (!staff) throw AppError.notFound('Staff profile not found');

  const fields = ['bio', 'yearsExperience', 'licenseNumber', 'serviceAreas', 'availability'];
  fields.forEach((field) => {
    if (data[field] !== undefined) staff[field] = data[field];
  });
  await staff.save();

  await logAudit({
    userId,
    action: 'STAFF_PROFILE_UPDATED',
    req,
    entityType: 'Staff',
    entityId: staff.id,
    metadata: { fields: Object.keys(data) },
  });

  return staff;
}

async function approveStaff(staffId, req) {
  const staff = await Staff.findByPk(staffId);
  if (!staff) throw AppError.notFound('Staff record not found');

  staff.approvalStatus = 'APPROVED';
  await staff.save();

  await logAudit({
    userId: req.user.id,
    action: 'STAFF_APPROVED',
    req,
    entityType: 'Staff',
    entityId: staff.id,
  });

  return staff;
}

async function rejectStaff(staffId, reason, req) {
  const staff = await Staff.findByPk(staffId);
  if (!staff) throw AppError.notFound('Staff record not found');

  staff.approvalStatus = 'REJECTED';
  await staff.save();

  await logAudit({
    userId: req.user.id,
    action: 'STAFF_REJECTED',
    req,
    entityType: 'Staff',
    entityId: staff.id,
    metadata: { reason },
  });

  return staff;
}

module.exports = { listStaff, getMyProfile, updateMyProfile, approveStaff, rejectStaff };
