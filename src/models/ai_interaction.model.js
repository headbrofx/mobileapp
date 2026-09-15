'use strict';

const { Model } = require('sequelize');

// Every question put to Afya AI and every answer it gave, kept whole.
// This is the record a reviewer reads, and the record that shows what
// the system told a patient on a given day.
module.exports = (sequelize, DataTypes) => {
  class AiInteraction extends Model {
    static associate(models) {
      AiInteraction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      AiInteraction.belongsTo(models.FamilyMember, { foreignKey: 'familyMemberId', as: 'familyMember' });
      AiInteraction.belongsTo(models.User, { foreignKey: 'reviewedBy', as: 'reviewer' });
    }
  }

  AiInteraction.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      familyMemberId: { type: DataTypes.UUID, allowNull: true, field: 'family_member_id' },
      question: { type: DataTypes.TEXT, allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: false },
      outcome: { type: DataTypes.ENUM('RED_FLAG', 'ANSWERED', 'NO_ANSWER'), allowNull: false },
      redFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'red_flag' },
      redFlagCategories: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: 'red_flag_categories',
      },
      sourceIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'source_ids' },
      reviewStatus: {
        type: DataTypes.ENUM('PENDING', 'REVIEWED_OK', 'FLAGGED_INCORRECT'),
        allowNull: false,
        defaultValue: 'PENDING',
        field: 'review_status',
      },
      needsReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'needs_review' },
      reviewerNote: { type: DataTypes.TEXT, allowNull: true, field: 'reviewer_note' },
      reviewedBy: { type: DataTypes.UUID, allowNull: true, field: 'reviewed_by' },
      reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
    },
    {
      sequelize,
      modelName: 'AiInteraction',
      tableName: 'ai_interactions',
      underscored: true,
      timestamps: true,
    }
  );

  return AiInteraction;
};
