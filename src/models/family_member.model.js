'use strict';

const { Model } = require('sequelize');

// The actual care recipient / patient — either the client themselves
// (relationship = SELF, isPrimaryAccountHolder = true) or a dependent
// the client manages care for (spouse, child, parent, ...).
// HealthProfile, HealthMeasurement, Symptom, bookings, etc. all attach
// to a FamilyMember, not directly to the client account.
module.exports = (sequelize, DataTypes) => {
  class FamilyMember extends Model {
    static associate(models) {
      FamilyMember.belongsTo(models.ClientProfile, { foreignKey: 'clientProfileId', as: 'clientProfile' });
      FamilyMember.hasOne(models.HealthProfile, { foreignKey: 'familyMemberId', as: 'healthProfile' });
      FamilyMember.hasMany(models.HealthMeasurement, { foreignKey: 'familyMemberId', as: 'healthMeasurements' });
      FamilyMember.hasMany(models.Symptom, { foreignKey: 'familyMemberId', as: 'symptoms' });
      FamilyMember.hasMany(models.MenstrualCycle, { foreignKey: 'familyMemberId', as: 'menstrualCycles' });
      FamilyMember.hasOne(models.NutritionProfile, { foreignKey: 'familyMemberId', as: 'nutritionProfile' });
      FamilyMember.hasMany(models.MealLog, { foreignKey: 'familyMemberId', as: 'mealLogs' });
      FamilyMember.hasMany(models.WaterLog, { foreignKey: 'familyMemberId', as: 'waterLogs' });
      FamilyMember.hasOne(models.FitnessProfile, { foreignKey: 'familyMemberId', as: 'fitnessProfile' });
      FamilyMember.hasMany(models.WorkoutLog, { foreignKey: 'familyMemberId', as: 'workoutLogs' });
      FamilyMember.hasMany(models.ActivityLog, { foreignKey: 'familyMemberId', as: 'activityLogs' });
      FamilyMember.hasMany(models.Booking, { foreignKey: 'familyMemberId', as: 'bookings' });
    }
  }

  FamilyMember.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      clientProfileId: { type: DataTypes.UUID, allowNull: false, field: 'client_profile_id' },
      name: { type: DataTypes.STRING, allowNull: false },
      relationship: {
        type: DataTypes.ENUM('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDPARENT', 'OTHER'),
        allowNull: false,
        defaultValue: 'SELF',
      },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true, field: 'date_of_birth' },
      gender: { type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER'), allowNull: true },
      isPrimaryAccountHolder: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_primary_account_holder',
      },
      // e.g. { "canBook": true, "canViewHealth": true, "canEditHealth": false }
      permissions: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'FamilyMember',
      tableName: 'family_members',
      underscored: true,
      timestamps: true,
    }
  );

  return FamilyMember;
};
