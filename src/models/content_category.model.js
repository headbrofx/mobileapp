'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ContentCategory extends Model {
    static associate(models) {
      ContentCategory.hasMany(models.Content, { foreignKey: 'categoryId', as: 'items' });
    }
  }

  ContentCategory.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    },
    {
      sequelize,
      modelName: 'ContentCategory',
      tableName: 'content_categories',
      underscored: true,
      timestamps: true,
    }
  );

  return ContentCategory;
};
