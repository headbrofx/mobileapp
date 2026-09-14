'use strict';

const { Model } = require('sequelize');

// One row per issued refresh token ("session"). Enables real logout
// (revoke one row), logout-everywhere (revoke all of a user's rows),
// visible session management, and rotation-reuse detection: refresh
// tokens rotate on every use, and re-presenting an already-revoked one
// revokes the whole family (signals possible theft).
module.exports = (sequelize, DataTypes) => {
  class RefreshTokenSession extends Model {
    static associate(models) {
      RefreshTokenSession.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  RefreshTokenSession.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      familyId: { type: DataTypes.UUID, allowNull: false, field: 'family_id' },
      userAgent: { type: DataTypes.STRING, allowNull: true, field: 'user_agent' },
      ipAddress: { type: DataTypes.STRING, allowNull: true, field: 'ip_address' },
      revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    },
    {
      sequelize,
      modelName: 'RefreshTokenSession',
      tableName: 'refresh_token_sessions',
      underscored: true,
      timestamps: true,
    }
  );

  return RefreshTokenSession;
};
