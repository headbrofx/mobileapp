'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('knowledge_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      title: { type: Sequelize.STRING, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      // Retrieval is scoped by category and the scopes never mix: a
      // question about prices must not be able to reach clinical
      // material, and a health question must not be answered with
      // marketing copy.
      category: {
        type: Sequelize.ENUM('COMPANY_INFO', 'SERVICE_INFO', 'HEALTH_EDUCATION'),
        allowNull: false,
      },
      language: { type: Sequelize.ENUM('SW', 'EN'), allowNull: false, defaultValue: 'SW' },
      source: { type: Sequelize.STRING, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      // The sign-off gate. HEALTH_EDUCATION is withheld from retrieval
      // entirely until a named professional approves it. Business
      // information carries no such gate — it is not clinical advice.
      verified_by_professional: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      verified_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('knowledge_items', ['category']);
    await queryInterface.addIndex('knowledge_items', ['verified_by_professional']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('knowledge_items');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_knowledge_items_category";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_knowledge_items_language";');
  },
};
