'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('menstrual_cycles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      cycle_start_date: { type: Sequelize.DATEONLY, allowNull: false },
      cycle_end_date: { type: Sequelize.DATEONLY, allowNull: true },
      flow: { type: Sequelize.ENUM('LIGHT', 'MEDIUM', 'HEAVY'), allowNull: true },
      symptoms: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      mood: { type: Sequelize.STRING, allowNull: true },
      predicted_next_start: { type: Sequelize.DATEONLY, allowNull: true },
      predicted_fertile_window_start: { type: Sequelize.DATEONLY, allowNull: true },
      predicted_fertile_window_end: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('menstrual_cycles', ['family_member_id', 'cycle_start_date']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('menstrual_cycles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_menstrual_cycles_flow";');
  },
};
