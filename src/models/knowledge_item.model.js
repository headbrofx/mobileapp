'use strict';

const { Model } = require('sequelize');

// The knowledge base Afya AI answers from. Nothing is generated: an
// answer is the content of one of these entries, returned with its
// source. That is deliberate — a vetted answer written by a nurse and
// signed off by a professional is safer than the same answer passed
// through a model that can reword it into something untrue.
module.exports = (sequelize, DataTypes) => {
  class KnowledgeItem extends Model {
    static associate(models) {
      KnowledgeItem.belongsTo(models.User, { foreignKey: 'createdBy', as: 'author' });
      KnowledgeItem.belongsTo(models.User, { foreignKey: 'verifiedBy', as: 'verifier' });
    }

    // HEALTH_EDUCATION is clinical material and stays out of retrieval
    // until a named professional signs it off. COMPANY_INFO and
    // SERVICE_INFO are business facts and carry no such gate.
    get isRetrievable() {
      return this.category !== 'HEALTH_EDUCATION' || this.verifiedByProfessional === true;
    }
  }

  KnowledgeItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      title: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      category: {
        type: DataTypes.ENUM('COMPANY_INFO', 'SERVICE_INFO', 'HEALTH_EDUCATION'),
        allowNull: false,
      },
      language: { type: DataTypes.ENUM('SW', 'EN'), allowNull: false, defaultValue: 'SW' },
      source: { type: DataTypes.STRING, allowNull: true },
      // A link, kept apart from the free-text `source` so the app can
      // make it tappable without guessing whether that text is a URL.
      sourceUrl: { type: DataTypes.TEXT, allowNull: true, field: 'source_url' },
      // The six-part answer, written by a reviewer rather than produced
      // at request time. There is no model in this path: a heading that
      // says "when urgent care may be needed" must sit over a sentence
      // somebody wrote for it.
      sections: { type: DataTypes.JSONB, allowNull: true },
      contentVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'content_version',
      },
      reviewNote: { type: DataTypes.TEXT, allowNull: true, field: 'review_note' },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
      verifiedByProfessional: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'verified_by_professional',
      },
      verifiedBy: { type: DataTypes.UUID, allowNull: true, field: 'verified_by' },
      verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
    },
    {
      sequelize,
      modelName: 'KnowledgeItem',
      tableName: 'knowledge_items',
      underscored: true,
      timestamps: true,
    }
  );

  return KnowledgeItem;
};
