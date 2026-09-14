'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('water_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      amount_ml: { type: Sequelize.INTEGER, allowNull: false },
      logged_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('water_logs', ['family_member_id', 'logged_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('water_logs');
  },
};
