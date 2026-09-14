'use strict';

const { Model } = require('sequelize');

// The home-care marketplace core (full state-machine logic built out in
// Phase 5). Phase 1 defines the shape and the status enum.
module.exports = (sequelize, DataTypes) => {
  class Booking extends Model {
    static associate(models) {
      Booking.belongsTo(models.ClientProfile, { foreignKey: 'clientProfileId', as: 'clientProfile' });
      Booking.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'patient' });
      Booking.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });
      Booking.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
      Booking.hasOne(models.Visit, { foreignKey: 'bookingId', as: 'visit' });
      Booking.hasMany(models.BookingLocationPing, { foreignKey: 'bookingId', as: 'locationPings' });
    }
  }

  Booking.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      clientProfileId: { type: DataTypes.UUID, allowNull: false, field: 'client_profile_id' },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      serviceId: { type: DataTypes.UUID, allowNull: false, field: 'service_id' },
      staffId: { type: DataTypes.UUID, allowNull: true, field: 'staff_id' },
      status: {
        type: DataTypes.ENUM(
          'REQUESTED',
          'ASSIGNED',
          'ACCEPTED',
          'ON_THE_WAY',
          'ARRIVED',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
          'RESCHEDULED'
        ),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },
      locationAddress: { type: DataTypes.TEXT, allowNull: false, field: 'location_address' },
      locationLat: { type: DataTypes.FLOAT, allowNull: true, field: 'location_lat' },
      locationLng: { type: DataTypes.FLOAT, allowNull: true, field: 'location_lng' },
      scheduledAt: { type: DataTypes.DATE, allowNull: false, field: 'scheduled_at' },
      notes: { type: DataTypes.TEXT, allowNull: true }, // client's description of the need
      cancellationReason: { type: DataTypes.TEXT, allowNull: true, field: 'cancellation_reason' },
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
      underscored: true,
      timestamps: true,
    }
  );

  return Booking;
};
