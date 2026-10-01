'use strict';

const { Model } = require('sequelize');
const { generateReference } = require('../utils/reference');

// "Take me to care": getting a patient to a facility. Distinct from a
// booking (nobody is coming to treat anyone at home) so it has its own
// lifecycle; see transportStateMachine.service.
module.exports = (sequelize, DataTypes) => {
  class TransportRequest extends Model {
    static associate(models) {
      TransportRequest.belongsTo(models.ClientProfile, { foreignKey: 'clientProfileId', as: 'clientProfile' });
      TransportRequest.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'patient' });
      TransportRequest.belongsTo(models.Staff, { foreignKey: 'assignedStaffId', as: 'driver' });
      TransportRequest.belongsTo(models.ServiceZone, { foreignKey: 'serviceZoneId', as: 'zone' });
    }
  }

  TransportRequest.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      bookingReference: { type: DataTypes.STRING(16), allowNull: false, unique: true, field: 'booking_reference' },
      clientProfileId: { type: DataTypes.UUID, allowNull: false, field: 'client_profile_id' },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      createdByUserId: { type: DataTypes.UUID, allowNull: true, field: 'created_by_user_id' },
      serviceZoneId: { type: DataTypes.UUID, allowNull: true, field: 'service_zone_id' },

      pickupAddress: { type: DataTypes.TEXT, allowNull: false, field: 'pickup_address' },
      pickupLat: { type: DataTypes.FLOAT, allowNull: true, field: 'pickup_lat' },
      pickupLng: { type: DataTypes.FLOAT, allowNull: true, field: 'pickup_lng' },
      pickupDetails: { type: DataTypes.JSONB, allowNull: true, field: 'pickup_details' },

      destinationType: {
        type: DataTypes.ENUM('HOSPITAL', 'CLINIC', 'FACILITY', 'PHARMACY', 'OTHER'),
        allowNull: false,
        field: 'destination_type',
      },
      destinationName: { type: DataTypes.STRING, allowNull: false, field: 'destination_name' },
      destinationAddress: { type: DataTypes.TEXT, allowNull: true, field: 'destination_address' },
      destinationLat: { type: DataTypes.FLOAT, allowNull: true, field: 'destination_lat' },
      destinationLng: { type: DataTypes.FLOAT, allowNull: true, field: 'destination_lng' },

      passengerCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'passenger_count' },
      scheduledAt: { type: DataTypes.DATE, allowNull: false, field: 'scheduled_at' },
      mobilityNeeds: { type: DataTypes.TEXT, allowNull: true, field: 'mobility_needs' },
      companionName: { type: DataTypes.STRING, allowNull: true, field: 'companion_name' },
      contactPhone: { type: DataTypes.STRING(20), allowNull: false, field: 'contact_phone' },
      notes: { type: DataTypes.TEXT, allowNull: true },

      status: {
        type: DataTypes.ENUM(
          'REQUESTED',
          'UNDER_REVIEW',
          'QUOTED',
          'ACCEPTED',
          'ASSIGNED',
          'EN_ROUTE',
          'ARRIVED_PICKUP',
          'IN_TRIP',
          'ARRIVED_DESTINATION',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
          'FAILED',
          'EXPIRED'
        ),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },

      quotedFareTzs: { type: DataTypes.INTEGER, allowNull: true, field: 'quoted_fare_tzs' },
      confirmedFareTzs: { type: DataTypes.INTEGER, allowNull: true, field: 'confirmed_fare_tzs' },
      quoteNote: { type: DataTypes.TEXT, allowNull: true, field: 'quote_note' },

      assignedStaffId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_staff_id' },
      partnerName: { type: DataTypes.STRING, allowNull: true, field: 'partner_name' },
      partnerReference: { type: DataTypes.STRING, allowNull: true, field: 'partner_reference' },
      driverName: { type: DataTypes.STRING, allowNull: true, field: 'driver_name' },
      driverPhone: { type: DataTypes.STRING(20), allowNull: true, field: 'driver_phone' },
      vehicleDetails: { type: DataTypes.STRING, allowNull: true, field: 'vehicle_details' },

      cancellationReason: { type: DataTypes.TEXT, allowNull: true, field: 'cancellation_reason' },
      idempotencyKey: { type: DataTypes.STRING(80), allowNull: true, field: 'idempotency_key' },
    },
    {
      sequelize,
      modelName: 'TransportRequest',
      tableName: 'transport_requests',
      underscored: true,
      timestamps: true,
    }
  );

  // Every row gets a reference, including ones made outside the
  // service (fixtures, scripts). The service retries on the rare clash.
  TransportRequest.beforeValidate((row) => {
    if (!row.bookingReference) row.bookingReference = generateReference('TRANSPORT');
  });

  return TransportRequest;
};
