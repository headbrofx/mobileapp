'use strict';

const { Model } = require('sequelize');

// Generic notification record. The reusable reminder engine (Phase 12)
// and SMS-automation for offline staff/partners both write here.
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, { foreignKey: 'userId', as: 'recipient' });
    }
  }

  Notification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      type: {
        type: DataTypes.ENUM('BOOKING', 'HEALTH', 'SYSTEM', 'REMINDER', 'MARKETING'),
        allowNull: false,
        defaultValue: 'SYSTEM',
      },
      title: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      data: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} }, // e.g. { bookingId }
      status: {
        type: DataTypes.ENUM('PENDING', 'SENT', 'READ', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
      readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      underscored: true,
      timestamps: true,
    }
  );

  return Notification;
};
