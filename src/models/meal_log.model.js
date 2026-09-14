'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MealLog extends Model {
    static associate(models) {
      MealLog.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  MealLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      mealType: {
        type: DataTypes.ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'),
        allowNull: false,
        field: 'meal_type',
      },
      items: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // [{ name, quantity, calories }]
      totalCalories: { type: DataTypes.INTEGER, allowNull: true, field: 'total_calories' },
      loggedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'logged_at' },
    },
    {
      sequelize,
      modelName: 'MealLog',
      tableName: 'meal_logs',
      underscored: true,
      timestamps: true,
    }
  );

  return MealLog;
};
