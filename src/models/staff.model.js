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
      Staff.hasMany(models.TransportRequest, { foreignKey: 'assignedStaffId', as: 'transportTrips' });
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
      // { mon: [{ from: '08:00', to: '17:00' }], tue: [...], ... } in
      // East Africa time. Absent means "not stated", which the
      // dispatcher sees as unknown rather than as always-on.
      workingHours: { type: DataTypes.JSONB, allowNull: true, field: 'working_hours' },
      unavailableUntil: { type: DataTypes.DATE, allowNull: true, field: 'unavailable_until' },
      baseLat: { type: DataTypes.FLOAT, allowNull: true, field: 'base_lat' },
      baseLng: { type: DataTypes.FLOAT, allowNull: true, field: 'base_lng' },
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
