'use strict';

const { Model } = require('sequelize');

// Catalog of home-care services (Home Nursing, Elderly Care, Wound Care,
// Physiotherapy, Postnatal Care, Medication Administration, Follow-up,
// Health Education, ...). Standalone reference table.
module.exports = (sequelize, DataTypes) => {
  class Service extends Model {
    static associate(models) {
      Service.hasMany(models.Booking, { foreignKey: 'serviceId', as: 'bookings' });
    }
  }

  Service.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      category: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      basePriceTzs: { type: DataTypes.INTEGER, allowNull: true, field: 'base_price_tzs' },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_minutes' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      sequelize,
      modelName: 'Service',
      tableName: 'services',
      underscored: true,
      timestamps: true,
    }
  );

  return Service;
};
