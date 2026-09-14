'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fitness_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      goal: {
        type: Sequelize.ENUM('WEIGHT_LOSS', 'MUSCLE_GAIN', 'ENDURANCE', 'GENERAL_FITNESS', 'REHAB'),
        allowNull: false,
        defaultValue: 'GENERAL_FITNESS',
      },
      activity_level: {
        type: Sequelize.ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'),
        allowNull: false,
        defaultValue: 'SEDENTARY',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('fitness_profiles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fitness_profiles_goal";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_fitness_profiles_activity_level";');
  },
};
