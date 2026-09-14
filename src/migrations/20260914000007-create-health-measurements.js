'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('health_measurements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      recorded_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.ENUM(
          'BLOOD_PRESSURE',
          'BLOOD_GLUCOSE',
          'HEART_RATE',
          'TEMPERATURE',
          'OXYGEN_SATURATION',
          'WEIGHT',
          'HEIGHT',
          'BMI'
        ),
        allowNull: false,
      },
      value: { type: Sequelize.FLOAT, allowNull: true },
      systolic: { type: Sequelize.INTEGER, allowNull: true },
      diastolic: { type: Sequelize.INTEGER, allowNull: true },
      unit: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      recorded_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('health_measurements', ['family_member_id', 'type', 'recorded_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('health_measurements');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_health_measurements_type";');
  },
};
