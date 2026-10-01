'use strict';

const { Model } = require('sequelize');

// Every status change of a booking or a transport request, with who
// made it. Append-only; the tracking timeline is drawn from here.
module.exports = (sequelize, DataTypes) => {
  class StatusHistory extends Model {
    static associate(models) {
      StatusHistory.belongsTo(models.User, { foreignKey: 'actorUserId', as: 'actor' });
    }
  }

  StatusHistory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      entityType: { type: DataTypes.ENUM('BOOKING', 'TRANSPORT'), allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      fromStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'from_status' },
      toStatus: { type: DataTypes.STRING(32), allowNull: false, field: 'to_status' },
      actorUserId: { type: DataTypes.UUID, allowNull: true, field: 'actor_user_id' },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'StatusHistory',
      tableName: 'status_history',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  return StatusHistory;
};
