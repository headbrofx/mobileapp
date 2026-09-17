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
// Words that carry no meaning for retrieval. Postgres ships stopword
// lists for English and a dozen other languages, but none for Swahili,
// and the 'simple' configuration this uses strips none at all.
//
// Without this list the ranking is driven by filler. "shinikizo la damu
// ni nini" scored exactly as highly as a real question about services,
// because "ni" and "nini" matched a title containing both — and the
// answer it produced was a page about the company.
const STOPWORDS = new Set([
  // Kiswahili
  'ni', 'na', 'ya', 'wa', 'za', 'la', 'cha', 'vya', 'kwa', 'katika', 'kama',
  'lakini', 'au', 'pia', 'hii', 'hiyo', 'hizi', 'hizo', 'huu', 'huo', 'hilo',
  'ile', 'yule', 'wale', 'gani', 'nini', 'nani', 'lini', 'wapi', 'vipi', 'je',
  'sana', 'tu', 'bado', 'tena', 'sasa', 'hapa', 'pale', 'kule', 'ili', 'kwamba',
  'yangu', 'yako', 'yake', 'yetu', 'yenu', 'yao', 'wangu', 'wako', 'wake',
  'wetu', 'wenu', 'wao', 'zangu', 'zako', 'zake', 'changu', 'chako', 'chake',
  'mimi', 'wewe', 'yeye', 'sisi', 'ninyi', 'nina', 'una', 'ana', 'tuna', 'mna',
  'wana', 'kuna', 'ndiyo', 'hapana', 'siyo', 'zaidi', 'kila', 'yoyote',
  // English
  'the', 'and', 'for', 'are', 'was', 'were', 'what', 'how', 'when', 'where',
  'why', 'who', 'this', 'that', 'these', 'those', 'you', 'your', 'our', 'their',
  'his', 'her', 'can', 'will', 'does', 'did', 'with', 'from', 'about', 'have',
  'has', 'had', 'any', 'all', 'more', 'please', 'tell',
]);

// A match has to be worth something. One incidental word shared with a
// long document is noise, not an answer — and serving noise as an answer
// is how a question about diabetes gets replied to with a price list.
//
// The floor comes from measuring, not taste. With stopwords removed,
// real questions about the service score 0.041 to 0.087. A clinical
// question that merely brushes a business entry — "nitumie dawa gani ya
// malaria" catching a page that happens to contain the word dawa —
// scores 0.020. The floor sits between them, nearer the noise, leaving
// room for a legitimate question phrased more loosely than these.
//
// Deliberately cautious. Below the floor the answer is an honest "I do
// not have a verified answer, ask your nurse", and for a health question
// that is a better outcome than a business page that happens to share a
// word. A near miss must not be decided by a hair.
const MIN_RANK = 0.025;

function buildQuery(question) {
  const terms = normalize(question)
    .split(' ')
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

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
      AND ts_rank(to_tsvector('simple', title || ' ' || content),
                  to_tsquery('simple', :tsquery)) >= :minRank
    ORDER BY rank DESC, created_at ASC
    LIMIT :limit
    `,
    { replacements: { tsquery, limit, minRank: MIN_RANK }, type: sequelize.QueryTypes.SELECT }
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

module.exports = { search, create, verify, list, buildQuery, STOPWORDS, MIN_RANK };
