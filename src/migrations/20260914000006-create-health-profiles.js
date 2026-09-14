'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('health_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      conditions: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      allergies: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      medications: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      medical_history: { type: Sequelize.TEXT, allowNull: true },
      blood_type: { type: Sequelize.STRING, allowNull: true },
      height_cm: { type: Sequelize.FLOAT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('health_profiles');
  },
};
