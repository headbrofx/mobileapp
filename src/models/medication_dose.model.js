'use strict';

const { Model } = require('sequelize');

// One scheduled dose. These are generated ahead from the medicine's
// schedule so the app knows what is coming, and they are what adherence
// is counted from.
module.exports = (sequelize, DataTypes) => {
  class MedicationDose extends Model {
    static associate(models) {
      MedicationDose.belongsTo(models.Medication, { foreignKey: 'medicationId', as: 'medication' });
      MedicationDose.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  MedicationDose.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      medicationId: { type: DataTypes.UUID, allowNull: false, field: 'medication_id' },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      scheduledFor: { type: DataTypes.DATE, allowNull: false, field: 'scheduled_for' },
      status: {
        type: DataTypes.ENUM('PENDING', 'TAKEN', 'MISSED', 'SKIPPED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      takenAt: { type: DataTypes.DATE, allowNull: true, field: 'taken_at' },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'MedicationDose', tableName: 'medication_doses', underscored: true, timestamps: true }
  );

  return MedicationDose;
};
