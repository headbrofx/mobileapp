'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FitnessProfile extends Model {
    static associate(models) {
      FitnessProfile.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  FitnessProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'family_member_id' },
      goal: {
        type: DataTypes.ENUM('WEIGHT_LOSS', 'MUSCLE_GAIN', 'ENDURANCE', 'GENERAL_FITNESS', 'REHAB'),
        allowNull: false,
        defaultValue: 'GENERAL_FITNESS',
      },
      activityLevel: {
        type: DataTypes.ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'),
        allowNull: false,
        defaultValue: 'SEDENTARY',
        field: 'activity_level',
      },
    },
    {
      sequelize,
      modelName: 'FitnessProfile',
      tableName: 'fitness_profiles',
      underscored: true,
      timestamps: true,
    }
  );

  return FitnessProfile;
};
