'use strict';

const { Op } = require('sequelize');
const { Content, ContentCategory, User } = require('../models');
const AppError = require('../utils/appError');
const { logAudit } = require('./audit.service');

// The reading library: articles, podcasts and news.
//
// DRAFT is the gate. Nothing reaches a patient until somebody with an
// admin account publishes it deliberately, and the publisher is
// recorded in the audit log. Health writing that nobody has read before
// it goes out is how bad advice reaches people at scale.
//
// This is separate from the Afya AI knowledge base (Phase 8) on
// purpose. That one answers questions and carries a professional
// sign-off gate; this one is material a person chooses to read.

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function uniqueSlug(base, ignoreId = null) {
  let candidate = base || 'makala';
  let n = 1;

  // Titles repeat — two "Chanjo za watoto" pieces a year apart — so the
  // slug gets a suffix rather than the save failing.
  for (;;) {
    const where = { slug: candidate };
    if (ignoreId) where.id = { [Op.ne]: ignoreId };
    const clash = await Content.findOne({ where });
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

// --- Categories ---

async function listCategories() {
  return ContentCategory.findAll({ order: [['name', 'ASC']] });
}

async function createCategory({ name, slug }) {
  const finalSlug = slug ? slugify(slug) : slugify(name);
  const clash = await ContentCategory.findOne({ where: { slug: finalSlug } });
  if (clash) throw AppError.conflict('A category with that slug already exists');
  return ContentCategory.create({ name, slug: finalSlug });
}

// --- Content ---

async function create(payload, { userId = null, req = null } = {}) {
  if (payload.categoryId) {
    const category = await ContentCategory.findByPk(payload.categoryId);
    if (!category) throw AppError.badRequest('That category does not exist');
  }

  const slug = await uniqueSlug(payload.slug ? slugify(payload.slug) : slugify(payload.title));

  const content = await Content.create({
    ...payload,
    slug,
    authorId: userId,
    // Always starts as a draft, whatever the caller sent. Publishing is
    // its own deliberate act.
    status: 'DRAFT',
    publishedAt: null,
  });

  await logAudit({
    userId,
    action: 'CONTENT_CREATED',
    entityType: 'Content',
    entityId: content.id,
    req,
    metadata: { title: content.title, type: content.type },
  });

  return content;
}

async function update(id, payload, { userId = null, req = null } = {}) {
  const content = await Content.findByPk(id);
  if (!content) throw AppError.notFound('Content not found');

  if (payload.title && !payload.slug && content.status === 'DRAFT') {
    // A published piece keeps its slug even if the title is corrected,
    // so links already shared do not break.
    payload.slug = await uniqueSlug(slugify(payload.title), content.id);
  } else if (payload.slug) {
    payload.slug = await uniqueSlug(slugify(payload.slug), content.id);
  }

  // Status is moved by publish/unpublish, never by a general edit.
  delete payload.status;
  delete payload.publishedAt;

  await content.update(payload);
  await logAudit({
    userId,
    action: 'CONTENT_UPDATED',
    entityType: 'Content',
    entityId: content.id,
    req,
  });

  return content.reload();
}

function assertPublishable(content) {
  if (content.type === 'ARTICLE' && !content.body) {
    throw AppError.badRequest('An article needs a body before it can be published');
  }
  if (content.type === 'PODCAST' && !content.audioUrl) {
    throw AppError.badRequest('A podcast needs an audio URL before it can be published');
  }
  if (content.type === 'NEWS' && !content.body && !content.sourceUrl) {
    throw AppError.badRequest('A news item needs either a body or a source URL before it can be published');
  }
}

async function publish(id, { userId = null, req = null } = {}) {
  const content = await Content.findByPk(id);
  if (!content) throw AppError.notFound('Content not found');

  assertPublishable(content);

  content.status = 'PUBLISHED';
  content.publishedAt = content.publishedAt || new Date();
  await content.save();

  // Who let this out, and when. Worth knowing later if something in it
  // turns out to be wrong.
  await logAudit({
    userId,
    action: 'CONTENT_PUBLISHED',
    entityType: 'Content',
    entityId: content.id,
    req,
    metadata: { title: content.title },
  });

  return content;
}

async function unpublish(id, { userId = null, req = null } = {}) {
  const content = await Content.findByPk(id);
  if (!content) throw AppError.notFound('Content not found');

  content.status = 'DRAFT';
  await content.save();

  await logAudit({
    userId,
    action: 'CONTENT_UNPUBLISHED',
    entityType: 'Content',
    entityId: content.id,
    req,
  });

  return content;
}

async function list({ type = null, categoryId = null, tag = null, q = null, includeDrafts = false } = {}) {
  const where = {};

  // Drafts are visible to admins only. Everyone else sees the library.
  if (!includeDrafts) where.status = 'PUBLISHED';
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (tag) where.tags = { [Op.contains]: [tag] };
  if (q) {
    where[Op.or] = [{ title: { [Op.iLike]: `%${q}%` } }, { body: { [Op.iLike]: `%${q}%` } }];
  }

  return Content.findAll({
    where,
    include: [
      { model: ContentCategory, as: 'category', attributes: ['id', 'name', 'slug'], required: false },
      { model: User, as: 'author', attributes: ['id', 'name'], required: false },
    ],
    order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    limit: 100,
  });
}

async function getBySlug(slug, { includeDrafts = false } = {}) {
  const where = { slug };
  if (!includeDrafts) where.status = 'PUBLISHED';

  const content = await Content.findOne({
    where,
    include: [
      { model: ContentCategory, as: 'category', attributes: ['id', 'name', 'slug'], required: false },
      { model: User, as: 'author', attributes: ['id', 'name'], required: false },
    ],
  });

  // A draft reads as absent rather than forbidden, so an unpublished
  // title cannot be discovered by guessing slugs.
  if (!content) throw AppError.notFound('Content not found');
  return content;
}

module.exports = {
  listCategories,
  createCategory,
  create,
  update,
  publish,
  unpublish,
  list,
  getBySlug,
  slugify,
};
