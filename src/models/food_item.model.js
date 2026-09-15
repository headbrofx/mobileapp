'use strict';

const { Model } = require('sequelize');

// A small catalogue of foods people in Dar es Salaam actually eat, so
// logging a meal does not require the user to know what a plate of
// ugali comes to.
//
// The seeded calorie figures are approximations for common household
// portions. They are good enough to show someone roughly how their day
// went; they are not laboratory values, nobody qualified has signed
// them off yet, and every response that carries them says so.
module.exports = (sequelize, DataTypes) => {
  class FoodItem extends Model {
    static associate() {
      // Meals store their items as JSONB rather than by foreign key, so
      // a user can log something the catalogue has never heard of.
    }
  }

  FoodItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      nameSw: { type: DataTypes.STRING, allowNull: false, field: 'name_sw' },
      nameEn: { type: DataTypes.STRING, allowNull: true, field: 'name_en' },
      category: {
        type: DataTypes.ENUM(
          'STARCH',
          'LEGUME',
          'PROTEIN',
          'VEGETABLE',
          'FRUIT',
          'DAIRY',
          'DRINK',
          'SNACK',
          'OTHER'
        ),
        allowNull: false,
        defaultValue: 'OTHER',
      },
      servingDescription: { type: DataTypes.STRING, allowNull: false, field: 'serving_description' },
      caloriesPerServing: { type: DataTypes.INTEGER, allowNull: false, field: 'calories_per_serving' },
      source: { type: DataTypes.STRING, allowNull: true },
      verifiedByProfessional: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'verified_by_professional',
      },
    },
    {
      sequelize,
      modelName: 'FoodItem',
      tableName: 'food_items',
      underscored: true,
      timestamps: true,
    }
  );

  return FoodItem;
};
