'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Human-readable invoice numbers come from a database sequence
    // rather than a count of existing rows. Two invoices raised in the
    // same second must never be handed the same number, and COUNT(*)+1
    // cannot promise that.
    await queryInterface.sequelize.query('CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;');

    await queryInterface.createTable('invoices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      number: { type: Sequelize.STRING, allowNull: false, unique: true },
      client_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_profiles', key: 'id' },
        onDelete: 'RESTRICT',
      },
      booking_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'bookings', key: 'id' },
        onDelete: 'SET NULL',
      },
      // Whole Tanzanian shillings, as an integer. Money is never a
      // float: 0.1 + 0.2 is not 0.3 in binary floating point, and an
      // invoice that disagrees with itself by a cent is a lost
      // afternoon and a lost customer.
      amount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'TZS' },
      status: {
        type: Sequelize.ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      issued_at: { type: Sequelize.DATE, allowNull: true },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('invoices', ['client_profile_id', 'status']);

    await queryInterface.createTable('invoice_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'CASCADE',
      },
      description: { type: Sequelize.STRING, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      unit_price: { type: Sequelize.INTEGER, allowNull: false },
      // quantity * unit_price, worked out on the server. A total the
      // client sent is a number the client chose.
      amount: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('invoice_items', ['invoice_id']);

    await queryInterface.createTable('payments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'RESTRICT',
      },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      method: {
        type: Sequelize.ENUM('CASH', 'MPESA', 'TIGOPESA', 'AIRTELMONEY', 'HALOPESA', 'BANK', 'OTHER'),
        allowNull: false,
      },
      // The mobile-money confirmation code, or a bank reference. Free
      // text, because nothing here talks to a payment provider yet.
      reference: { type: Sequelize.STRING, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      // Who took the money. Cash in a home-care business passes through
      // a person's hands, and that person has a name.
      recorded_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      // False on every row until a real gateway confirms a payment.
      // Nobody should read a manually keyed entry as money verified by
      // Vodacom.
      gateway_confirmed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('payments', ['invoice_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('invoice_items');
    await queryInterface.dropTable('invoices');
    await queryInterface.sequelize.query('DROP SEQUENCE IF EXISTS invoice_number_seq;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invoices_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_method";');
  },
};
