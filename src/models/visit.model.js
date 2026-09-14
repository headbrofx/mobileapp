'use strict';

const { Model } = require('sequelize');

// The clinical record of a completed (or in-progress) home visit
// (Phase 6 builds the full before/during/after workflow on top of this).
module.exports = (sequelize, DataTypes) => {
  class Visit extends Model {
    static associate(models) {
      Visit.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
      Visit.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
    }
  }

  Visit.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      bookingId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'booking_id' },
      staffId: { type: DataTypes.UUID, allowNull: false, field: 'staff_id' },
      checkInAt: { type: DataTypes.DATE, allowNull: true, field: 'check_in_at' },
      checkOutAt: { type: DataTypes.DATE, allowNull: true, field: 'check_out_at' },
      assessment: { type: DataTypes.TEXT, allowNull: true },
      vitalsSnapshot: { type: DataTypes.JSONB, allowNull: true, defaultValue: {}, field: 'vitals_snapshot' },
      treatmentNotes: { type: DataTypes.TEXT, allowNull: true, field: 'treatment_notes' },
      recommendations: { type: DataTypes.TEXT, allowNull: true },
      followUpDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'follow_up_date' },
      attachments: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // [{ url, type }]
    },
    {
      sequelize,
      modelName: 'Visit',
      tableName: 'visits',
      underscored: true,
      timestamps: true,
    }
  );

  return Visit;
};
