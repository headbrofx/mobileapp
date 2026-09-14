'use strict';

const { Model } = require('sequelize');

// One per FamilyMember. Goals/preferences container for the Nutrition
// module (Phase 10) — meal planning, local/Tanzanian food database, and
// Afya AI meal suggestions all read this.
module.exports = (sequelize, DataTypes) => {
  class NutritionProfile extends Model {
    static associate(models) {
      NutritionProfile.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  NutritionProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'family_member_id' },
      goal: {
        type: DataTypes.ENUM('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MANAGE_CONDITION', 'GENERAL_HEALTH'),
        allowNull: false,
        defaultValue: 'GENERAL_HEALTH',
      },
      dailyCalorieTarget: { type: DataTypes.INTEGER, allowNull: true, field: 'daily_calorie_target' },
      dailyWaterTargetMl: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 2000, field: 'daily_water_target_ml' },
      dietaryPreferences: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'dietary_preferences' }, // ["vegetarian"]
      restrictions: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // ["no shellfish"]
    },
    {
      sequelize,
      modelName: 'NutritionProfile',
      tableName: 'nutrition_profiles',
      underscored: true,
      timestamps: true,
    }
  );

  return NutritionProfile;
};
