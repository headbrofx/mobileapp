'use strict';

const { Model } = require('sequelize');

// Append-only security/audit trail. userId is nullable because failed
// login attempts (wrong identifier) have no known user yet.
module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  AuditLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
      action: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: true, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: true, field: 'entity_id' },
      ipAddress: { type: DataTypes.STRING, allowNull: true, field: 'ip_address' },
      userAgent: { type: DataTypes.STRING, allowNull: true, field: 'user_agent' },
      metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      underscored: true,
      timestamps: true,
      updatedAt: false, // append-only
    }
  );

  return AuditLog;
};
