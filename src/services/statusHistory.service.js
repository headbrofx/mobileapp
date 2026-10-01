'use strict';

const { StatusHistory, User } = require('../models');

// One row per status change, for bookings and transport requests
// alike. The tracking timeline a client sees is read from here, and so
// is the dispatcher's "how long did assignment take".
async function record({ entityType, entityId, fromStatus = null, toStatus, actorUserId = null, note = null }) {
  return StatusHistory.create({ entityType, entityId, fromStatus, toStatus, actorUserId, note });
}

// `forClient` drops who did it. A client sees what happened and when;
// which dispatcher pressed the button is the business's own record.
async function timeline(entityType, entityId, { forClient = false } = {}) {
  const rows = await StatusHistory.findAll({
    where: { entityType, entityId },
    include: forClient ? [] : [{ model: User, as: 'actor', attributes: ['id', 'name', 'role'] }],
    order: [['createdAt', 'ASC']],
  });

  return rows.map((row) => ({
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    at: row.createdAt,
    note: row.note,
    ...(forClient ? {} : { actor: row.actor ? { id: row.actor.id, name: row.actor.name, role: row.actor.role } : null }),
  }));
}

module.exports = { record, timeline };
