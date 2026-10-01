'use strict';

const { Model } = require('sequelize');

// Where the business operates. A centre and a radius per zone; a new
// city is a row, not a release.
module.exports = (sequelize, DataTypes) => {
  class ServiceZone extends Model {}

  ServiceZone.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      region: { type: DataTypes.STRING, allowNull: false },
      centerLat: { type: DataTypes.FLOAT, allowNull: false, field: 'center_lat' },
      centerLng: { type: DataTypes.FLOAT, allowNull: false, field: 'center_lng' },
      radiusKm: { type: DataTypes.FLOAT, allowNull: false, field: 'radius_km' },
      homeVisits: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'home_visits' },
      transport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      sequelize,
      modelName: 'ServiceZone',
      tableName: 'service_zones',
      underscored: true,
      timestamps: true,
    }
  );

  return ServiceZone;
};
