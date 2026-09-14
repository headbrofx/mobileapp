'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WorkoutLog extends Model {
    static associate(models) {
      WorkoutLog.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  WorkoutLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      exerciseType: { type: DataTypes.STRING, allowNull: false, field: 'exercise_type' },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: false, field: 'duration_minutes' },
      caloriesBurned: { type: DataTypes.INTEGER, allowNull: true, field: 'calories_burned' },
      intensity: {
        type: DataTypes.ENUM('LOW', 'MODERATE', 'HIGH'),
        allowNull: false,
        defaultValue: 'MODERATE',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      loggedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'logged_at' },
    },
    {
      sequelize,
      modelName: 'WorkoutLog',
      tableName: 'workout_logs',
      underscored: true,
      timestamps: true,
    }
  );

  return WorkoutLog;
};
