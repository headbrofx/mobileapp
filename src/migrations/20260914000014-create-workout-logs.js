'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('workout_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      exercise_type: { type: Sequelize.STRING, allowNull: false },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: false },
      calories_burned: { type: Sequelize.INTEGER, allowNull: true },
      intensity: { type: Sequelize.ENUM('LOW', 'MODERATE', 'HIGH'), allowNull: false, defaultValue: 'MODERATE' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      logged_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('workout_logs', ['family_member_id', 'logged_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('workout_logs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_workout_logs_intensity";');
  },
};
