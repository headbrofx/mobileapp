'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      // Recorded exactly as the prescriber wrote it. Nothing in this
      // codebase interprets, converts or recalculates a dose.
      dosage: { type: Sequelize.STRING, allowNull: false },
      form: {
        type: Sequelize.ENUM('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'INHALER', 'OTHER'),
        allowNull: false,
        defaultValue: 'TABLET',
      },
      // Times of day as "HH:MM", e.g. ["08:00","20:00"]. Tanzania keeps
      // a fixed UTC+3 with no daylight saving, so a wall-clock time
      // converts to an instant without ambiguity.
      schedule_times: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      instructions: { type: Sequelize.TEXT, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      // Who prescribed it. Free text, because it is usually a clinic or
      // a doctor who has no account here.
      prescribed_by: { type: Sequelize.STRING, allowNull: true },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'COMPLETED', 'STOPPED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('medications', ['family_member_id', 'status']);

    await queryInterface.createTable('medication_doses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      medication_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'medications', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Denormalised so a nurse can read a patient's whole dose history
      // without joining through every medication they have ever had.
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      scheduled_for: { type: Sequelize.DATE, allowNull: false },
      status: {
        type: Sequelize.ENUM('PENDING', 'TAKEN', 'MISSED', 'SKIPPED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      taken_at: { type: Sequelize.DATE, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('medication_doses', ['family_member_id', 'scheduled_for']);
    // Regenerating a schedule must never produce a second row for a slot
    // that already exists, or a patient sees the same dose twice.
    await queryInterface.addConstraint('medication_doses', {
      fields: ['medication_id', 'scheduled_for'],
      type: 'unique',
      name: 'medication_doses_medication_id_scheduled_for_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('medication_doses');
    await queryInterface.dropTable('medications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_medication_doses_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_medications_form";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_medications_status";');
  },
};
