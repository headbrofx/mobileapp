'use strict';

const { Model } = require('sequelize');

// One line on an invoice. amount is quantity * unitPrice, computed on
// the server every time.
module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {
    static associate(models) {
      InvoiceItem.belongsTo(models.Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
    }
  }

  InvoiceItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      invoiceId: { type: DataTypes.UUID, allowNull: false, field: 'invoice_id' },
      description: { type: DataTypes.STRING, allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      unitPrice: { type: DataTypes.INTEGER, allowNull: false, field: 'unit_price' },
      amount: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'InvoiceItem', tableName: 'invoice_items', underscored: true, timestamps: true }
  );

  return InvoiceItem;
};
