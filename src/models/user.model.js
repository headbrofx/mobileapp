'use strict';

const { Model } = require('sequelize');

// Phase 0: minimal User model to prove the auth architecture end-to-end.
// Full data model (ClientProfile, Staff, HealthProfile, Bookings, ...)
// is built out in Phase 1.
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasOne(models.ClientProfile, { foreignKey: 'userId', as: 'clientProfile' });
      User.hasOne(models.Staff, { foreignKey: 'userId', as: 'staffProfile' });
      User.hasMany(models.HealthMeasurement, { foreignKey: 'recordedByUserId', as: 'recordedMeasurements' });
      User.hasMany(models.Content, { foreignKey: 'authorId', as: 'authoredContent' });
      User.hasMany(models.Notification, { foreignKey: 'userId', as: 'notifications' });
      User.hasMany(models.AIConversation, { foreignKey: 'userId', as: 'aiConversations' });
      User.hasMany(models.RefreshTokenSession, { foreignKey: 'userId', as: 'refreshSessions' });
      User.hasMany(models.PasswordResetToken, { foreignKey: 'userId', as: 'passwordResetTokens' });
      User.hasMany(models.VerificationCode, { foreignKey: 'userId', as: 'verificationCodes' });
      User.hasMany(models.AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
    }

    toSafeJSON() {
      const { passwordHash, ...safe } = this.toJSON();
      return safe;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_hash',
      },
      role: {
        type: DataTypes.ENUM('CLIENT', 'STAFF', 'ADMIN'),
        allowNull: false,
        defaultValue: 'CLIENT',
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'),
        allowNull: false,
        defaultValue: 'PENDING_VERIFICATION',
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      timestamps: true,
    }
  );

  return User;
};
