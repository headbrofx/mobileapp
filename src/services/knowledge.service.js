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
    SELECT id, title, content, category, language, source, source_url,
           sections, content_version, verified_by_professional, verified_at,
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

// How well the served entry actually matched, in three words.
//
// Two things decide it, and both come out of retrieval rather than out
// of an opinion. The rank is how strongly the entry matched at all. The
// margin is how far ahead of the runner-up it was — a question that
// matches three entries almost equally has not found *the* answer, it
// has found a shelf, and serving the top of that shelf with confidence
// is how somebody gets the wrong page stated firmly.
//
// The thresholds sit on the measurements already recorded in MIN_RANK's
// comment: real matches score 0.041 to 0.087, brushes score 0.020.
//
// This is not shown to the user as a number. A percentage next to a
// health answer invites somebody to read 70% as "probably true", when
// what it measures is word overlap. LOW is surfaced as a sentence
// suggesting they ask a nurse; HIGH and MEDIUM are surfaced as nothing
// at all, which is the honest amount.
function scoreConfidence(matches) {
  if (matches.length === 0) return { confidence: 'NONE', rank: null };

  const rank = Number(matches[0].rank) || 0;
  const runnerUp = matches.length > 1 ? Number(matches[1].rank) || 0 : 0;
  const margin = rank - runnerUp;

  if (rank >= 0.06 && margin >= 0.015) return { confidence: 'HIGH', rank };
  if (rank >= 0.04) return { confidence: 'MEDIUM', rank };
  return { confidence: 'LOW', rank };
}

// What the app is allowed to show about where an answer came from.
//
// Deliberately a whitelist rather than the row: a knowledge item also
// carries who wrote it and an internal review note, and neither belongs
// in a client response.
function toReference(match) {
  return {
    id: match.id,
    title: match.title,
    category: match.category,
    source: match.source ?? null,
    sourceUrl: match.source_url ?? null,
    contentVersion: match.content_version ?? 1,
    reviewedAt: match.verified_at ?? null,
    reviewed: Boolean(match.verified_by_professional),
  };
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

module.exports = {
  search,
  create,
  verify,
  list,
  buildQuery,
  scoreConfidence,
  toReference,
  STOPWORDS,
  MIN_RANK,
};
