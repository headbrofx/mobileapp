'use strict';

const { Model } = require('sequelize');

// Operational rules an admin can change without a deploy. Only keys
// settings.service knows about are ever written; see DEFAULTS there.
module.exports = (sequelize, DataTypes) => {
  class AppSetting extends Model {}

  AppSetting.init(
    {
      key: { type: DataTypes.STRING(80), primaryKey: true },
      value: { type: DataTypes.JSONB, allowNull: false },
      updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
    },
    {
      sequelize,
      modelName: 'AppSetting',
      tableName: 'app_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return AppSetting;
};
