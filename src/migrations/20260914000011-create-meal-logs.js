'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('meal_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      meal_type: { type: Sequelize.ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'), allowNull: false },
      items: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      total_calories: { type: Sequelize.INTEGER, allowNull: true },
      logged_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('meal_logs', ['family_member_id', 'logged_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('meal_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_meal_logs_meal_type";');
  },
};
