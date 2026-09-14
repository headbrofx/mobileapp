'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset_tokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('password_reset_tokens', ['token_hash']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('password_reset_tokens');
  },
};
