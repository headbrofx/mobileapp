'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PasswordResetToken extends Model {
    static associate(models) {
      PasswordResetToken.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  PasswordResetToken.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      tokenHash: { type: DataTypes.STRING, allowNull: false, field: 'token_hash' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
      usedAt: { type: DataTypes.DATE, allowNull: true, field: 'used_at' },
    },
    {
      sequelize,
      modelName: 'PasswordResetToken',
      tableName: 'password_reset_tokens',
      underscored: true,
      timestamps: true,
    }
  );

  return PasswordResetToken;
};
