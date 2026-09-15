'use strict';

const { KnowledgeItem, sequelize } = require('../models');
const AppError = require('../utils/appError');
const { normalize } = require('./aiRedFlags.service');

// Retrieval uses Postgres' own full-text search. No embeddings, no
// vector database, no API key — the search runs inside the database we
// already pay nothing for.
//
// The 'simple' text configuration is used rather than 'english' on
// purpose: English stemming mangles Swahili, and Postgres ships no
// Swahili dictionary. 'simple' just folds case and splits on word
// boundaries, which is the right behaviour for both languages here.
function buildQuery(question) {
  const terms = normalize(question)
    .split(' ')
    .filter((word) => word.length >= 3);

  if (terms.length === 0) return null;
  // OR rather than AND: a question phrased as a sentence should not have
  // to match every word it contains to find the right entry.
  return terms.join(' | ');
}

async function search(question, { limit = 3 } = {}) {
  const tsquery = buildQuery(question);
  if (!tsquery) return [];

  // Clinical material is withheld until signed off. Business
  // information carries no such gate.
  //
  // Categories are not separated at query time the way a generative
  // engine would need to: an answer here is one entry returned word for
  // word with its category attached, so there is no blending of
  // marketing copy into clinical text for it to prevent.
  const rows = await sequelize.query(
    `
    SELECT id, title, content, category, language, source,
           ts_rank(to_tsvector('simple', title || ' ' || content),
                   to_tsquery('simple', :tsquery)) AS rank
    FROM knowledge_items
    WHERE (category <> 'HEALTH_EDUCATION' OR verified_by_professional = true)
      AND to_tsvector('simple', title || ' ' || content) @@ to_tsquery('simple', :tsquery)
    ORDER BY rank DESC, created_at ASC
    LIMIT :limit
    `,
    { replacements: { tsquery, limit }, type: sequelize.QueryTypes.SELECT }
  );

  return rows;
}

async function create({ title, content, category, language, source, createdBy }) {
  return KnowledgeItem.create({ title, content, category, language, source, createdBy });
}

async function verify(id, verifierId) {
  const item = await KnowledgeItem.findByPk(id);
  if (!item) throw AppError.notFound('Knowledge item not found');

  item.verifiedByProfessional = true;
  item.verifiedBy = verifierId;
  item.verifiedAt = new Date();
  await item.save();
  return item;
}

async function list({ category = null, includeUnverified = false } = {}) {
  const where = {};
  if (category) where.category = category;
  const items = await KnowledgeItem.findAll({ where, order: [['createdAt', 'DESC']] });
  return includeUnverified ? items : items.filter((item) => item.isRetrievable);
}

module.exports = { search, create, verify, list, buildQuery };
