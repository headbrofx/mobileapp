'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      client_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      service_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'services', key: 'id' },
        onDelete: 'RESTRICT',
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'staff_profiles', key: 'id' },
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM(
          'REQUESTED',
          'ASSIGNED',
          'ACCEPTED',
          'ON_THE_WAY',
          'ARRIVED',
          'IN_PROGRESS',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
          'RESCHEDULED'
        ),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },
      location_address: { type: Sequelize.TEXT, allowNull: false },
      location_lat: { type: Sequelize.FLOAT, allowNull: true },
      location_lng: { type: Sequelize.FLOAT, allowNull: true },
      scheduled_at: { type: Sequelize.DATE, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['staff_id']);
    await queryInterface.addIndex('bookings', ['client_profile_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bookings');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bookings_status";');
  },
};
