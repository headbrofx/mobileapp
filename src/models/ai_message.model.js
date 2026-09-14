'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AIMessage extends Model {
    static associate(models) {
      AIMessage.belongsTo(models.AIConversation, { foreignKey: 'conversationId', as: 'conversation' });
    }
  }

  AIMessage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      conversationId: { type: DataTypes.UUID, allowNull: false, field: 'conversation_id' },
      role: { type: DataTypes.ENUM('USER', 'ASSISTANT', 'SYSTEM'), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: 'AIMessage',
      tableName: 'ai_messages',
      underscored: true,
      timestamps: true,
    }
  );

  return AIMessage;
};
