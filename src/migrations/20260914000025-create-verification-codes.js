'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verification_codes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      channel: { type: Sequelize.ENUM('PHONE', 'EMAIL'), allowNull: false },
      code_hash: { type: Sequelize.STRING, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('verification_codes', ['user_id', 'channel']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('verification_codes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_verification_codes_channel";');
  },
};
