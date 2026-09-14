'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('BOOKING', 'HEALTH', 'SYSTEM', 'REMINDER', 'MARKETING'),
        allowNull: false,
        defaultValue: 'SYSTEM',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      data: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      status: { type: Sequelize.ENUM('PENDING', 'SENT', 'READ', 'FAILED'), allowNull: false, defaultValue: 'PENDING' },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('notifications', ['user_id', 'status']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_status";');
  },
};
