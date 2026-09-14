'use strict';

const { Model } = require('sequelize');

// One per FamilyMember (patient). The baseline medical record that
// Afya AI, staff, and the health-insights engine (Phase 3) read from.
module.exports = (sequelize, DataTypes) => {
  class HealthProfile extends Model {
    static associate(models) {
      HealthProfile.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  HealthProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'family_member_id' },
      conditions: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // ["Hypertension", "Type 2 Diabetes"]
      allergies: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // ["Penicillin"]
      medications: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }, // [{ name, dosage, frequency }]
      medicalHistory: { type: DataTypes.TEXT, allowNull: true, field: 'medical_history' },
      bloodType: { type: DataTypes.STRING, allowNull: true, field: 'blood_type' },
      heightCm: { type: DataTypes.FLOAT, allowNull: true, field: 'height_cm' },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'HealthProfile',
      tableName: 'health_profiles',
      underscored: true,
      timestamps: true,
    }
  );

  return HealthProfile;
};
