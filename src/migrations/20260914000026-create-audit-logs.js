'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      action: { type: Sequelize.STRING, allowNull: false },
      entity_type: { type: Sequelize.STRING, allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      ip_address: { type: Sequelize.STRING, allowNull: true },
      user_agent: { type: Sequelize.STRING, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
