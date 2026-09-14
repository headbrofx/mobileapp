'use strict';

const { Model } = require('sequelize');

// A chat thread with Afya AI (Phase 8 builds the gateway/safety-layer/
// context-engine on top). context stores which of the user's health
// data they've authorized the AI to use for this thread.
module.exports = (sequelize, DataTypes) => {
  class AIConversation extends Model {
    static associate(models) {
      AIConversation.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      AIConversation.hasMany(models.AIMessage, { foreignKey: 'conversationId', as: 'messages' });
    }
  }

  AIConversation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      title: { type: DataTypes.STRING, allowNull: true },
      // e.g. { "authorizedContext": ["symptoms", "vitals", "medications"] }
      context: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'AIConversation',
      tableName: 'ai_conversations',
      underscored: true,
      timestamps: true,
    }
  );

  return AIConversation;
};
