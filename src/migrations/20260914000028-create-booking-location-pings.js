'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_location_pings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      booking_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'bookings', key: 'id' },
        onDelete: 'CASCADE',
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        // Ephemeral tracking data, not a clinical record (unlike Visit) —
        // fine to cascade away if the staff account itself is removed.
        references: { model: 'staff_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      lat: { type: Sequelize.FLOAT, allowNull: false },
      lng: { type: Sequelize.FLOAT, allowNull: false },
      recorded_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('booking_location_pings', ['booking_id', 'recorded_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('booking_location_pings');
  },
};
