'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('symptom_catalog_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      category: {
        type: Sequelize.ENUM(
          'GENERAL',
          'RESPIRATORY',
          'DIGESTIVE',
          'NEUROLOGICAL',
          'CARDIOVASCULAR',
          'MUSCULOSKELETAL',
          'SKIN',
          'OTHER'
        ),
        allowNull: false,
        defaultValue: 'GENERAL',
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      common_triggers: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      related_symptoms: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      always_red_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      red_flag_severity: { type: Sequelize.ENUM('MILD', 'MODERATE', 'SEVERE'), allowNull: true },
      red_flag_duration_days: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('symptom_catalog_items');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptom_catalog_items_category";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptom_catalog_items_red_flag_severity";');
  },
};
