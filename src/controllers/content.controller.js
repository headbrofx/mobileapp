'use strict';

const service = require('../services/content.service');
const { success } = require('../utils/apiResponse');

const isAdmin = (req) => req.user.role === 'ADMIN';

async function listCategories(req, res, next) {
  try {
    const categories = await service.listCategories();
    return success(res, { message: 'Content categories', data: { categories } });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await service.createCategory(req.body);
    return success(res, { statusCode: 201, message: 'Category created', data: { category } });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const items = await service.list({
      type: req.query.type,
      categoryId: req.query.categoryId,
      tag: req.query.tag,
      q: req.query.q,
      // Only an admin sees what has not been published.
      includeDrafts: isAdmin(req) && req.query.includeDrafts === 'true',
    });
    return success(res, { message: 'Content', data: { items } });
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    const item = await service.getBySlug(req.params.slug, { includeDrafts: isAdmin(req) });
    return success(res, { message: 'Content', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await service.create(req.body, { userId: req.user.id, req });
    return success(res, { statusCode: 201, message: 'Content created as a draft', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await service.update(req.params.id, req.body, { userId: req.user.id, req });
    return success(res, { message: 'Content updated', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function publish(req, res, next) {
  try {
    const item = await service.publish(req.params.id, { userId: req.user.id, req });
    return success(res, { message: 'Content published', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function unpublish(req, res, next) {
  try {
    const item = await service.unpublish(req.params.id, { userId: req.user.id, req });
    return success(res, { message: 'Content unpublished', data: { item } });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories, createCategory, list, getBySlug, create, update, publish, unpublish };
