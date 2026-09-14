'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('client_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      address: { type: Sequelize.TEXT, allowNull: true },
      city: { type: Sequelize.STRING, allowNull: true, defaultValue: 'Dar es Salaam' },
      emergency_contact_name: { type: Sequelize.STRING, allowNull: true },
      emergency_contact_phone: { type: Sequelize.STRING, allowNull: true },
      emergency_contact_relationship: { type: Sequelize.STRING, allowNull: true },
      preferences: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('client_profiles');
  },
};
