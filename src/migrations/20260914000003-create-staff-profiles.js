'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('staff_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      specialty: {
        type: Sequelize.ENUM('NURSE', 'PHYSIOTHERAPIST', 'CAREGIVER', 'GENERAL_PRACTITIONER', 'OPERATIONS', 'OTHER'),
        allowNull: false,
        defaultValue: 'NURSE',
      },
      license_number: { type: Sequelize.STRING, allowNull: true },
      bio: { type: Sequelize.TEXT, allowNull: true },
      years_experience: { type: Sequelize.INTEGER, allowNull: true },
      availability: {
        type: Sequelize.ENUM('AVAILABLE', 'BUSY', 'OFFLINE'),
        allowNull: false,
        defaultValue: 'OFFLINE',
      },
      service_areas: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      approval_status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('staff_profiles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_staff_profiles_specialty";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_staff_profiles_availability";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_staff_profiles_approval_status";');
  },
};
