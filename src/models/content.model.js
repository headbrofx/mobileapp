'use strict';

const { Model } = require('sequelize');

// Unified table for articles, podcasts and news (Phase 13 builds full
// content-platform features — personalization, moderation — on top).
// `type` decides which fields are relevant: ARTICLE uses body, PODCAST
// uses audioUrl/transcript, NEWS uses sourceUrl.
module.exports = (sequelize, DataTypes) => {
  class Content extends Model {
    static associate(models) {
      Content.belongsTo(models.ContentCategory, { foreignKey: 'categoryId', as: 'category' });
      Content.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
    }
  }

  Content.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: true, field: 'category_id' },
      authorId: { type: DataTypes.UUID, allowNull: true, field: 'author_id' },
      type: { type: DataTypes.ENUM('ARTICLE', 'PODCAST', 'NEWS'), allowNull: false, defaultValue: 'ARTICLE' },
      title: { type: DataTypes.STRING, allowNull: false },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      body: { type: DataTypes.TEXT, allowNull: true }, // ARTICLE
      audioUrl: { type: DataTypes.STRING, allowNull: true, field: 'audio_url' }, // PODCAST
      transcript: { type: DataTypes.TEXT, allowNull: true }, // PODCAST
      sourceUrl: { type: DataTypes.STRING, allowNull: true, field: 'source_url' }, // NEWS
      tags: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
      status: { type: DataTypes.ENUM('DRAFT', 'PUBLISHED'), allowNull: false, defaultValue: 'DRAFT' },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
    },
    {
      sequelize,
      modelName: 'Content',
      tableName: 'content_items',
      underscored: true,
      timestamps: true,
    }
  );

  return Content;
};
