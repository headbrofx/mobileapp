'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('symptoms', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      severity: { type: Sequelize.ENUM('MILD', 'MODERATE', 'SEVERE'), allowNull: false, defaultValue: 'MILD' },
      duration_value: { type: Sequelize.INTEGER, allowNull: true },
      duration_unit: { type: Sequelize.ENUM('HOURS', 'DAYS', 'WEEKS'), allowNull: true },
      frequency: {
        type: Sequelize.ENUM('ONE_TIME', 'INTERMITTENT', 'CONSTANT'),
        allowNull: false,
        defaultValue: 'ONE_TIME',
      },
      triggers: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      notes: { type: Sequelize.TEXT, allowNull: true },
      occurred_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('symptoms', ['family_member_id', 'occurred_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('symptoms');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptoms_severity";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptoms_duration_unit";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_symptoms_frequency";');
  },
};
