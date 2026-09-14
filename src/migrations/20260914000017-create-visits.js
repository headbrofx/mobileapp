'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('visits', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      booking_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'bookings', key: 'id' },
        onDelete: 'CASCADE',
      },
      staff_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'staff_profiles', key: 'id' },
        onDelete: 'RESTRICT',
      },
      check_in_at: { type: Sequelize.DATE, allowNull: true },
      check_out_at: { type: Sequelize.DATE, allowNull: true },
      assessment: { type: Sequelize.TEXT, allowNull: true },
      vitals_snapshot: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      treatment_notes: { type: Sequelize.TEXT, allowNull: true },
      recommendations: { type: Sequelize.TEXT, allowNull: true },
      follow_up_date: { type: Sequelize.DATEONLY, allowNull: true },
      attachments: { type: Sequelize.JSONB, allowNull: true, defaultValue: [] },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('visits');
  },
};
