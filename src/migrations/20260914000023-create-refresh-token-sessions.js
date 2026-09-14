'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_token_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      family_id: { type: Sequelize.UUID, allowNull: false },
      user_agent: { type: Sequelize.STRING, allowNull: true },
      ip_address: { type: Sequelize.STRING, allowNull: true },
      revoked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('refresh_token_sessions', ['user_id', 'revoked']);
    await queryInterface.addIndex('refresh_token_sessions', ['family_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('refresh_token_sessions');
  },
};
