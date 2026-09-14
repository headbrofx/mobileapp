'use strict';

const { Op } = require('sequelize');
const { SymptomCatalogItem } = require('../models');

async function list({ category } = {}) {
  return SymptomCatalogItem.findAll({
    where: category ? { category } : {},
    order: [['name', 'ASC']],
  });
}

async function findByName(name) {
  if (!name) return null;
  return SymptomCatalogItem.findOne({ where: { name: { [Op.iLike]: name } } });
}

module.exports = { list, findByName };
