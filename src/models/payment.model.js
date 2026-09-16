'use strict';

const { Model } = require('sequelize');

// Money received against an invoice. Every row names the person who
// recorded it, because cash in a home-care business passes through
// somebody's hands.
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
      Payment.belongsTo(models.User, { foreignKey: 'recordedBy', as: 'recorder' });
    }
  }

  Payment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      invoiceId: { type: DataTypes.UUID, allowNull: false, field: 'invoice_id' },
      amount: { type: DataTypes.INTEGER, allowNull: false },
      method: {
        type: DataTypes.ENUM('CASH', 'MPESA', 'TIGOPESA', 'AIRTELMONEY', 'HALOPESA', 'BANK', 'OTHER'),
        allowNull: false,
      },
      reference: { type: DataTypes.STRING, allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'paid_at' },
      recordedBy: { type: DataTypes.UUID, allowNull: false, field: 'recorded_by' },
      // Stays false until a real payment provider confirms it. A
      // manually keyed entry must never read as money verified by
      // Vodacom.
      gatewayConfirmed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'gateway_confirmed',
      },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'Payment', tableName: 'payments', underscored: true, timestamps: true }
  );

  return Payment;
};
