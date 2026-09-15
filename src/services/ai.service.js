'use strict';

const { AiInteraction, FamilyMember, ClientProfile } = require('../models');
const AppError = require('../utils/appError');
const redFlags = require('./aiRedFlags.service');
const knowledge = require('./knowledge.service');
const { logAudit } = require('./audit.service');

// Share of ordinary interactions pulled into the review queue, so review
// is not only ever of the alarming ones and nobody finds out months
// later that the everyday answers were wrong.
const REVIEW_SAMPLE_RATE = 0.05;

const NO_ANSWER = [
  'Sina jibu lililothibitishwa kwa swali hili, kwa hiyo sitakisia.',
  'Tafadhali muulize muuguzi wako, au weka booking na Afya Nyumbani.',
  '',
  'I do not have a verified answer for this, so I will not guess.',
  'Please ask your nurse, or book a visit with Afya Nyumbani.',
].join('\n');

// The patient a question is about must belong to the person asking.
// Without this a client could read another family's history back out of
// their own interaction log.
async function assertOwnsFamilyMember(user, familyMemberId) {
  if (!familyMemberId) return null;

  const familyMember = await FamilyMember.findByPk(familyMemberId);
  if (!familyMember) throw AppError.notFound('Family member not found');

  if (user.role === 'ADMIN') return familyMember;

  const clientProfile = await ClientProfile.findByPk(familyMember.clientProfileId);
  if (!clientProfile || clientProfile.userId !== user.id) {
    throw AppError.forbidden('You do not have access to this family member');
  }
  return familyMember;
}

async function ask({ user, question, familyMemberId = null, req = null }) {
  await assertOwnsFamilyMember(user, familyMemberId);

  // Safety first, always, and before anything that can fail. If the
  // database were unreachable the line below would still have run.
  const flags = redFlags.detect(question);

  let answer;
  let outcome;
  let sourceIds = [];

  if (flags.isRedFlag) {
    // An emergency is never answered from the knowledge base. We do not
    // explain what the symptom might mean, we do not offer alternatives,
    // and we do not soften it — we say go now.
    answer = flags.guidance;
    outcome = 'RED_FLAG';
  } else {
    const matches = await knowledge.search(question);
    if (matches.length > 0) {
      // The answer IS the vetted entry, word for word. Nothing is
      // rewritten, so nothing can be invented.
      answer = matches[0].content;
      outcome = 'ANSWERED';
      sourceIds = matches.map((match) => match.id);
    } else {
      answer = NO_ANSWER;
      outcome = 'NO_ANSWER';
    }
  }

  const needsReview = flags.isRedFlag || Math.random() < REVIEW_SAMPLE_RATE;

  const interaction = await AiInteraction.create({
    userId: user.id,
    familyMemberId,
    question,
    answer,
    outcome,
    redFlag: flags.isRedFlag,
    redFlagCategories: flags.categories,
    sourceIds,
    needsReview,
  });

  if (flags.isRedFlag) {
    await logAudit({
      userId: user.id,
      action: 'AI_RED_FLAG',
      entityType: 'AiInteraction',
      entityId: interaction.id,
      req,
      metadata: { categories: flags.categories, familyMemberId },
    });
  }

  return {
    id: interaction.id,
    answer,
    outcome,
    redFlag: flags.isRedFlag,
    redFlagCategories: flags.categories,
    sources: sourceIds,
    needsReview,
  };
}

async function history({ user, familyMemberId = null }) {
  const where = { userId: user.id };
  if (familyMemberId) {
    await assertOwnsFamilyMember(user, familyMemberId);
    where.familyMemberId = familyMemberId;
  }

  return AiInteraction.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
}

async function reviewQueue({ status = 'PENDING' } = {}) {
  return AiInteraction.findAll({
    where: { needsReview: true, reviewStatus: status },
    order: [['redFlag', 'DESC'], ['createdAt', 'ASC']],
    limit: 100,
  });
}

async function review({ id, reviewerId, status, note = null, req = null }) {
  const interaction = await AiInteraction.findByPk(id);
  if (!interaction) throw AppError.notFound('Interaction not found');

  interaction.reviewStatus = status;
  interaction.reviewerNote = note;
  interaction.reviewedBy = reviewerId;
  interaction.reviewedAt = new Date();
  await interaction.save();

  await logAudit({
    userId: reviewerId,
    action: 'AI_INTERACTION_REVIEWED',
    entityType: 'AiInteraction',
    entityId: interaction.id,
    req,
    metadata: { status },
  });

  return interaction;
}

module.exports = { ask, history, reviewQueue, review, NO_ANSWER };
