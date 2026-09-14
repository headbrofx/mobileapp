'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('nutrition_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      goal: {
        type: Sequelize.ENUM('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MANAGE_CONDITION', 'GENERAL_HEALTH'),
        allowNull: false,
        defaultValue: 'GENERAL_HEALTH',
      },
      daily_calorie_target: { type: Sequelize.INTEGER, allowNull: true },
      daily_water_target_ml: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 2000 },
      dietary_preferences: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      restrictions: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('nutrition_profiles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_nutrition_profiles_goal";');
  },
};
