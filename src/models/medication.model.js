'use strict';

const { Model } = require('sequelize');

// A medicine somebody has been prescribed, recorded exactly as the
// prescriber wrote it. Nothing here interprets a dose, converts units,
// suggests a change, or decides that a medicine should stop. Those are
// clinical decisions and they belong to the prescriber.
module.exports = (sequelize, DataTypes) => {
  class Medication extends Model {
    static associate(models) {
      Medication.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
      Medication.hasMany(models.MedicationDose, { foreignKey: 'medicationId', as: 'doses' });
    }
  }

  Medication.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      name: { type: DataTypes.STRING, allowNull: false },
      dosage: { type: DataTypes.STRING, allowNull: false },
      form: {
        type: DataTypes.ENUM('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'INHALER', 'OTHER'),
        allowNull: false,
        defaultValue: 'TABLET',
      },
      scheduleTimes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'schedule_times' },
      instructions: { type: DataTypes.TEXT, allowNull: true },
      startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
      endDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'end_date' },
      prescribedBy: { type: DataTypes.STRING, allowNull: true, field: 'prescribed_by' },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'STOPPED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
    },
    { sequelize, modelName: 'Medication', tableName: 'medications', underscored: true, timestamps: true }
  );

  return Medication;
};
