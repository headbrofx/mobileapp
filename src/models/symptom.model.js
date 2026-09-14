'use strict';

const { Model } = require('sequelize');

// Symptom tracking (Phase 4 builds the full engine on top of this table:
// catalogue, trends, red-flag rules). Phase 1 just needs the shape.
module.exports = (sequelize, DataTypes) => {
  class Symptom extends Model {
    static associate(models) {
      Symptom.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  Symptom.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      name: { type: DataTypes.STRING, allowNull: false }, // e.g. "Headache"
      severity: {
        type: DataTypes.ENUM('MILD', 'MODERATE', 'SEVERE'),
        allowNull: false,
        defaultValue: 'MILD',
      },
      durationValue: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_value' },
      durationUnit: {
        type: DataTypes.ENUM('HOURS', 'DAYS', 'WEEKS'),
        allowNull: true,
        field: 'duration_unit',
      },
      frequency: {
        type: DataTypes.ENUM('ONE_TIME', 'INTERMITTENT', 'CONSTANT'),
        allowNull: false,
        defaultValue: 'ONE_TIME',
      },
      triggers: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
      notes: { type: DataTypes.TEXT, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'occurred_at' },
    },
    {
      sequelize,
      modelName: 'Symptom',
      tableName: 'symptoms',
      underscored: true,
      timestamps: true,
    }
  );

  return Symptom;
};
