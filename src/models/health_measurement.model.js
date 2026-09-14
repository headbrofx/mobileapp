'use strict';

const { Model } = require('sequelize');

// A single vitals/measurement reading (BP, glucose, heart rate,
// temperature, oxygen, weight, ...). Self-logged by the client or
// recorded by staff during a visit.
module.exports = (sequelize, DataTypes) => {
  class HealthMeasurement extends Model {
    static associate(models) {
      HealthMeasurement.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
      HealthMeasurement.belongsTo(models.User, { foreignKey: 'recordedByUserId', as: 'recordedBy' });
    }
  }

  HealthMeasurement.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      recordedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'recorded_by_user_id' },
      type: {
        type: DataTypes.ENUM(
          'BLOOD_PRESSURE',
          'BLOOD_GLUCOSE',
          'HEART_RATE',
          'TEMPERATURE',
          'OXYGEN_SATURATION',
          'WEIGHT',
          'HEIGHT',
          'BMI'
        ),
        allowNull: false,
      },
      value: { type: DataTypes.FLOAT, allowNull: true }, // primary value (e.g. glucose mg/dL, weight kg)
      systolic: { type: DataTypes.INTEGER, allowNull: true }, // BP only
      diastolic: { type: DataTypes.INTEGER, allowNull: true }, // BP only
      unit: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'recorded_at' },
    },
    {
      sequelize,
      modelName: 'HealthMeasurement',
      tableName: 'health_measurements',
      underscored: true,
      timestamps: true,
    }
  );

  return HealthMeasurement;
};
