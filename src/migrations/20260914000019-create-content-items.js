'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'content_categories', key: 'id' },
        onDelete: 'SET NULL',
      },
      author_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: { type: Sequelize.ENUM('ARTICLE', 'PODCAST', 'NEWS'), allowNull: false, defaultValue: 'ARTICLE' },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      body: { type: Sequelize.TEXT, allowNull: true },
      audio_url: { type: Sequelize.STRING, allowNull: true },
      transcript: { type: Sequelize.TEXT, allowNull: true },
      source_url: { type: Sequelize.STRING, allowNull: true },
      tags: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      status: { type: Sequelize.ENUM('DRAFT', 'PUBLISHED'), allowNull: false, defaultValue: 'DRAFT' },
      published_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('content_items', ['type', 'status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('content_items');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_items_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_items_status";');
  },
};
