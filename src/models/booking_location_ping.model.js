'use strict';

const { Model } = require('sequelize');

// A single GPS ping from a staff member while a booking is ON_THE_WAY.
// Append-only — the trail of pings is the booking's location history,
// the latest one is "where's my nurse right now".
module.exports = (sequelize, DataTypes) => {
  class BookingLocationPing extends Model {
    static associate(models) {
      BookingLocationPing.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
      BookingLocationPing.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
    }
  }

  BookingLocationPing.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      bookingId: { type: DataTypes.UUID, allowNull: false, field: 'booking_id' },
      staffId: { type: DataTypes.UUID, allowNull: false, field: 'staff_id' },
      lat: { type: DataTypes.FLOAT, allowNull: false },
      lng: { type: DataTypes.FLOAT, allowNull: false },
      recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'recorded_at' },
    },
    {
      sequelize,
      modelName: 'BookingLocationPing',
      tableName: 'booking_location_pings',
      underscored: true,
      timestamps: true,
      updatedAt: false, // append-only
    }
  );

  return BookingLocationPing;
};
