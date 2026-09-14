'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_messages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'ai_conversations', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.ENUM('USER', 'ASSISTANT', 'SYSTEM'), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('ai_messages', ['conversation_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ai_messages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_messages_role";');
  },
};
