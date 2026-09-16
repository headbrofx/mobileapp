'use strict';

const { Model } = require('sequelize');

// An invoice. Amounts are whole Tanzanian shillings held as integers —
// never floats, and never a total the client sent.
module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    static associate(models) {
      Invoice.belongsTo(models.ClientProfile, { foreignKey: 'clientProfileId', as: 'client' });
      Invoice.belongsTo(models.Booking, { foreignKey: 'bookingId', as: 'booking' });
      Invoice.hasMany(models.InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
      Invoice.hasMany(models.Payment, { foreignKey: 'invoiceId', as: 'payments' });
    }
  }

  Invoice.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      number: { type: DataTypes.STRING, allowNull: false, unique: true },
      clientProfileId: { type: DataTypes.UUID, allowNull: false, field: 'client_profile_id' },
      bookingId: { type: DataTypes.UUID, allowNull: true, field: 'booking_id' },
      amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'TZS' },
      status: {
        type: DataTypes.ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      issuedAt: { type: DataTypes.DATE, allowNull: true, field: 'issued_at' },
      dueDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'due_date' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
    },
    { sequelize, modelName: 'Invoice', tableName: 'invoices', underscored: true, timestamps: true }
  );

  return Invoice;
};
