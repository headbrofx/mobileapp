'use strict';

const { Model } = require('sequelize');

// Cycle entries for Women's Health (Phase 9). Predictions computed by
// that phase's engine are stored here but must always be surfaced to
// the user as estimates, not medical certainty.
module.exports = (sequelize, DataTypes) => {
  class MenstrualCycle extends Model {
    static associate(models) {
      MenstrualCycle.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  MenstrualCycle.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      cycleStartDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'cycle_start_date' },
      cycleEndDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'cycle_end_date' },
      flow: { type: DataTypes.ENUM('LIGHT', 'MEDIUM', 'HEAVY'), allowNull: true },
      symptoms: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // ["cramps", "bloating"]
      mood: { type: DataTypes.STRING, allowNull: true },
      // Estimates only — computed by the Phase 9 prediction engine, never
      // presented to the user as medical certainty.
      predictedNextStart: { type: DataTypes.DATEONLY, allowNull: true, field: 'predicted_next_start' },
      predictedFertileWindowStart: { type: DataTypes.DATEONLY, allowNull: true, field: 'predicted_fertile_window_start' },
      predictedFertileWindowEnd: { type: DataTypes.DATEONLY, allowNull: true, field: 'predicted_fertile_window_end' },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'MenstrualCycle',
      tableName: 'menstrual_cycles',
      underscored: true,
      timestamps: true,
    }
  );

  return MenstrualCycle;
};
