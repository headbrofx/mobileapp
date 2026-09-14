'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('family_members', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      client_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      relationship: {
        type: Sequelize.ENUM('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'GRANDPARENT', 'OTHER'),
        allowNull: false,
        defaultValue: 'SELF',
      },
      date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
      gender: { type: Sequelize.ENUM('MALE', 'FEMALE', 'OTHER'), allowNull: true },
      is_primary_account_holder: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      permissions: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('family_members', ['client_profile_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('family_members');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_family_members_relationship";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_family_members_gender";');
  },
};
