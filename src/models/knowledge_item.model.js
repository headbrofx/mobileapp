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
