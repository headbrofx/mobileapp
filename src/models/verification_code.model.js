'use strict';

const { Model } = require('sequelize');

// Short-lived OTP for phone/email verification. `attempts` rate-limits
// guessing. No SMS/email gateway is wired up yet (that's the Bolt/SMS
// integration work from later phases) — for now the code is logged and,
// outside production, returned in the API response so the flow is
// testable end to end.
module.exports = (sequelize, DataTypes) => {
  class VerificationCode extends Model {
    static associate(models) {
      VerificationCode.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  VerificationCode.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      channel: { type: DataTypes.ENUM('PHONE', 'EMAIL'), allowNull: false },
      codeHash: { type: DataTypes.STRING, allowNull: false, field: 'code_hash' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
      verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'VerificationCode',
      tableName: 'verification_codes',
      underscored: true,
      timestamps: true,
    }
  );

  return VerificationCode;
};
