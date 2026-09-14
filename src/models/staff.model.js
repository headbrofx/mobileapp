'use strict';

const { Model } = require('sequelize');

// The staff/nurse professional profile. One per User with role STAFF.
module.exports = (sequelize, DataTypes) => {
  class Staff extends Model {
    static associate(models) {
      Staff.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Staff.hasMany(models.Booking, { foreignKey: 'staffId', as: 'bookings' });
      Staff.hasMany(models.Visit, { foreignKey: 'staffId', as: 'visits' });
      Staff.hasMany(models.BookingLocationPing, { foreignKey: 'staffId', as: 'locationPings' });
    }
  }

  Staff.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'user_id' },
      specialty: {
        type: DataTypes.ENUM('NURSE', 'PHYSIOTHERAPIST', 'CAREGIVER', 'GENERAL_PRACTITIONER', 'OPERATIONS', 'OTHER'),
        allowNull: false,
        defaultValue: 'NURSE',
      },
      licenseNumber: { type: DataTypes.STRING, allowNull: true, field: 'license_number' },
      bio: { type: DataTypes.TEXT, allowNull: true },
      yearsExperience: { type: DataTypes.INTEGER, allowNull: true, field: 'years_experience' },
      availability: {
        type: DataTypes.ENUM('AVAILABLE', 'BUSY', 'OFFLINE'),
        allowNull: false,
        defaultValue: 'OFFLINE',
      },
      serviceAreas: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'service_areas' },
      approvalStatus: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING',
        field: 'approval_status',
      },
    },
    {
      sequelize,
      modelName: 'Staff',
      tableName: 'staff_profiles',
      underscored: true,
      timestamps: true,
    }
  );

  return Staff;
};
