'use strict';

const { Op } = require('sequelize');
const {
  User,
  Staff,
  Booking,
  Invoice,
  Payment,
  AiInteraction,
  ClientProfile,
} = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

// The operations backend: what an admin needs to run the business on a
// given morning.
//
// Accounts are suspended, never deleted. A deleted user takes their
// bookings, visit records and invoices with them, and those are things
// a health business is obliged to keep. SUSPENDED stops a login without
// destroying a history.

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_BOOKING_STATUSES = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];

async function dashboard() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);

  const [
    bookingsToday,
    unassigned,
    inFlight,
    staffPending,
    clientCount,
    staffCount,
    aiPendingReview,
    aiRedFlags7d,
    invoices,
  ] = await Promise.all([
    Booking.count({ where: { scheduledAt: { [Op.gte]: startOfToday, [Op.lt]: endOfToday } } }),
    // Nobody is going to these yet. This is the number that means work
    // is waiting for a person right now.
    Booking.count({ where: { status: 'REQUESTED' } }),
    Booking.count({ where: { status: { [Op.in]: ACTIVE_BOOKING_STATUSES } } }),
    Staff.count({ where: { approvalStatus: 'PENDING' } }),
    User.count({ where: { role: 'CLIENT' } }),
    User.count({ where: { role: 'STAFF' } }),
    AiInteraction.count({ where: { needsReview: true, reviewStatus: 'PENDING' } }),
    AiInteraction.count({
      where: { redFlag: true, createdAt: { [Op.gte]: new Date(Date.now() - 7 * DAY_MS) } },
    }),
    Invoice.findAll({
      where: { status: { [Op.in]: ['ISSUED', 'PARTIALLY_PAID'] } },
      include: [{ model: Payment, as: 'payments', attributes: ['amount'] }],
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  let owed = 0;
  let overdue = 0;
  for (const invoice of invoices) {
    const paid = (invoice.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    const balance = invoice.amount - paid;
    owed += balance;
    if (invoice.dueDate && invoice.dueDate < today) overdue += balance;
  }

  return {
    bookings: { today: bookingsToday, awaitingAssignment: unassigned, inProgress: inFlight },
    staff: { total: staffCount, awaitingApproval: staffPending },
    clients: { total: clientCount },
    // Surfaced here so a red flag cannot sit unread in a queue nobody
    // thinks to open.
    afyaAi: { awaitingReview: aiPendingReview, redFlagsLast7Days: aiRedFlags7d },
    money: { currency: 'TZS', outstanding: owed, overdue },
  };
}

async function listUsers({ role = null, status = null, q = null, limit = 100 } = {}) {
  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { phone: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } },
    ];
  }

  return User.findAll({
    where,
    // passwordHash is never selected. It has no business leaving the
    // database, least of all through a list endpoint.
    attributes: ['id', 'name', 'phone', 'email', 'role', 'status', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
  });
}

async function setUserStatus(targetId, { status, actor, req }) {
  if (targetId === actor.id) {
    // An admin who suspends themselves locks everyone out of the
    // controls that would undo it.
    throw AppError.badRequest('You cannot change your own account status');
  }

  const user = await User.findByPk(targetId);
  if (!user) throw AppError.notFound('User not found');

  const before = user.status;
  user.status = status;
  await user.save();

  await logAudit({
    userId: actor.id,
    action: 'USER_STATUS_CHANGED',
    entityType: 'User',
    entityId: user.id,
    req,
    metadata: { from: before, to: status },
  });

  return { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status };
}

async function setUserRole(targetId, { role, actor, req }) {
  if (targetId === actor.id) {
    // Stops an admin demoting themselves out of the only account that
    // could put it back.
    throw AppError.badRequest('You cannot change your own role');
  }

  const user = await User.findByPk(targetId);
  if (!user) throw AppError.notFound('User not found');

  const before = user.role;
  user.role = role;
  await user.save();

  // Granting admin is the single most sensitive thing this API does, so
  // it is written down with who did it and to whom.
  await logAudit({
    userId: actor.id,
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: user.id,
    req,
    metadata: { from: before, to: role, targetPhone: user.phone },
  });

  return { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status };
}

async function listStaff({ approvalStatus = null } = {}) {
  const where = {};
  if (approvalStatus) where.approvalStatus = approvalStatus;

  return Staff.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone', 'email', 'status'] }],
    order: [['approvalStatus', 'ASC'], ['createdAt', 'DESC']],
    limit: 200,
  });
}

async function listBookings({ status = null, from = null, to = null, limit = 100 } = {}) {
  const where = {};
  if (status) where.status = status;
  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt[Op.gte] = new Date(from);
    if (to) where.scheduledAt[Op.lte] = new Date(to);
  }

  return Booking.findAll({
    where,
    include: [
      { model: ClientProfile, as: 'clientProfile', required: false, attributes: ['id'] },
      { model: Staff, as: 'staff', required: false, attributes: ['id', 'specialty', 'availability'] },
    ],
    order: [['scheduledAt', 'DESC']],
    limit,
  });
}

module.exports = { dashboard, listUsers, setUserStatus, setUserRole, listStaff, listBookings };
