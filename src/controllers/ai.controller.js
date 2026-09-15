'use strict';

const aiService = require('../services/ai.service');
const knowledgeService = require('../services/knowledge.service');
const { success } = require('../utils/apiResponse');

async function ask(req, res, next) {
  try {
    const result = await aiService.ask({
      user: req.user,
      question: req.body.question,
      familyMemberId: req.body.familyMemberId || null,
      req,
    });
    return success(res, { message: 'Afya AI', data: result });
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const interactions = await aiService.history({
      user: req.user,
      familyMemberId: req.query.familyMemberId || null,
    });
    return success(res, { message: 'AI history', data: { interactions } });
  } catch (err) {
    next(err);
  }
}

async function listKnowledge(req, res, next) {
  try {
    const items = await knowledgeService.list({
      category: req.query.category,
      // Only an admin sees entries still waiting for a professional to
      // sign them off.
      includeUnverified: req.user.role === 'ADMIN',
    });
    return success(res, { message: 'Knowledge base', data: { items } });
  } catch (err) {
    next(err);
  }
}

async function createKnowledge(req, res, next) {
  try {
    const item = await knowledgeService.create({ ...req.body, createdBy: req.user.id });
    return success(res, { statusCode: 201, message: 'Knowledge item created', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function verifyKnowledge(req, res, next) {
  try {
    const item = await knowledgeService.verify(req.params.id, req.user.id);
    return success(res, { message: 'Knowledge item verified', data: { item } });
  } catch (err) {
    next(err);
  }
}

async function reviewQueue(req, res, next) {
  try {
    const interactions = await aiService.reviewQueue({ status: req.query.status || 'PENDING' });
    return success(res, { message: 'AI review queue', data: { interactions } });
  } catch (err) {
    next(err);
  }
}

async function review(req, res, next) {
  try {
    const interaction = await aiService.review({
      id: req.params.id,
      reviewerId: req.user.id,
      status: req.body.status,
      note: req.body.note || null,
      req,
    });
    return success(res, { message: 'Interaction reviewed', data: { interaction } });
  } catch (err) {
    next(err);
  }
}

module.exports = { ask, history, listKnowledge, createKnowledge, verifyKnowledge, reviewQueue, review };
