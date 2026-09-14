'use strict';

const { Model } = require('sequelize');

// Daily step/activity summary — one row per FamilyMember per day.
// Designed to be easy to fill from a wearable integration later (Phase 11).
module.exports = (sequelize, DataTypes) => {
  class ActivityLog extends Model {
    static associate(models) {
      ActivityLog.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  ActivityLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      steps: { type: DataTypes.INTEGER, allowNull: true },
      distanceKm: { type: DataTypes.FLOAT, allowNull: true, field: 'distance_km' },
      activeMinutes: { type: DataTypes.INTEGER, allowNull: true, field: 'active_minutes' },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'activity_logs',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['family_member_id', 'date'] }],
    }
  );

  return ActivityLog;
};
