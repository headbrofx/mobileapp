'use strict';

const { Model } = require('sequelize');

// A client's own addresses ("Nyumbani", "Kwa mama"), so the second
// booking does not start from a blank field.
module.exports = (sequelize, DataTypes) => {
  class SavedLocation extends Model {
    static associate(models) {
      SavedLocation.belongsTo(models.ClientProfile, { foreignKey: 'clientProfileId', as: 'clientProfile' });
    }
  }

  SavedLocation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      clientProfileId: { type: DataTypes.UUID, allowNull: false, field: 'client_profile_id' },
      label: { type: DataTypes.STRING(60), allowNull: false },
      address: { type: DataTypes.TEXT, allowNull: false },
      lat: { type: DataTypes.FLOAT, allowNull: true },
      lng: { type: DataTypes.FLOAT, allowNull: true },
      details: { type: DataTypes.JSONB, allowNull: true },
      isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_default' },
    },
    {
      sequelize,
      modelName: 'SavedLocation',
      tableName: 'saved_locations',
      underscored: true,
      timestamps: true,
    }
  );

  return SavedLocation;
};
