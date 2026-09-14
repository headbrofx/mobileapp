'use strict';

const { Model } = require('sequelize');

// The client account holder's profile. One per User with role CLIENT.
// The client may manage care for themselves and/or family members —
// see FamilyMember, which is the actual "patient" record.
module.exports = (sequelize, DataTypes) => {
  class ClientProfile extends Model {
    static associate(models) {
      ClientProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      ClientProfile.hasMany(models.FamilyMember, { foreignKey: 'clientProfileId', as: 'familyMembers' });
      ClientProfile.hasMany(models.Booking, { foreignKey: 'clientProfileId', as: 'bookings' });
    }
  }

  ClientProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'user_id' },
      address: { type: DataTypes.TEXT, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Dar es Salaam' },
      emergencyContactName: { type: DataTypes.STRING, allowNull: true, field: 'emergency_contact_name' },
      emergencyContactPhone: { type: DataTypes.STRING, allowNull: true, field: 'emergency_contact_phone' },
      emergencyContactRelationship: { type: DataTypes.STRING, allowNull: true, field: 'emergency_contact_relationship' },
      preferences: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'ClientProfile',
      tableName: 'client_profiles',
      underscored: true,
      timestamps: true,
    }
  );

  return ClientProfile;
};
