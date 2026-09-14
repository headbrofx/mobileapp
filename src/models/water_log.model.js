'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WaterLog extends Model {
    static associate(models) {
      WaterLog.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
    }
  }

  WaterLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      amountMl: { type: DataTypes.INTEGER, allowNull: false, field: 'amount_ml' },
      loggedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'logged_at' },
    },
    {
      sequelize,
      modelName: 'WaterLog',
      tableName: 'water_logs',
      underscored: true,
      timestamps: true,
    }
  );

  return WaterLog;
};
