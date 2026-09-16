'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { Booking, Visit, Invoice, Payment, Symptom, AiInteraction, Service, sequelize } = require('../models');

// Business and service analytics, for admins.
//
// Everything here is an aggregate. No row returned names a patient, and
// nothing joins back to one.
//
// Health breakdowns are suppressed below a threshold. Afya Nyumbani
// serves a small number of families in one city, so "1 case of X in
// Masaki this month" is not a statistic — it is a person, and anyone
// who knows the neighbourhood could work out which. Counts under the
// threshold are reported as a single "withheld" figure instead.
const SMALL_COUNT_THRESHOLD = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function since(days) {
  return new Date(Date.now() - days * DAY_MS);
}

// --- Bookings ---

async function bookingMetrics(days) {
  const from = since(days);

  const byStatus = await Booking.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    where: { createdAt: { [Op.gte]: from } },
    group: ['status'],
    raw: true,
  });

  const counts = byStatus.reduce((acc, row) => {
    acc[row.status] = Number(row.count);
    return acc;
  }, {});

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const completed = counts.COMPLETED || 0;
  const cancelled = (counts.CANCELLED || 0) + (counts.REJECTED || 0);

  const perWeek = await Booking.findAll({
    attributes: [
      [fn('date_trunc', 'week', col('created_at')), 'week'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: { createdAt: { [Op.gte]: from } },
    group: [literal('1')],
    order: [literal('1 ASC')],
    raw: true,
  });

  const topServices = await Booking.findAll({
    attributes: [[fn('COUNT', col('Booking.id')), 'count']],
    include: [{ model: Service, as: 'service', attributes: ['name'] }],
    where: { createdAt: { [Op.gte]: from } },
    group: ['service.id', 'service.name'],
    order: [[literal('count'), 'DESC']],
    limit: 5,
    raw: true,
    nest: true,
  });

  return {
    total,
    byStatus: counts,
    // Null rather than 0% when nothing was booked, which is a different
    // claim from everything having been cancelled.
    completionRate: total ? Math.round((completed / total) * 100) : null,
    cancellationRate: total ? Math.round((cancelled / total) * 100) : null,
    perWeek: perWeek.map((row) => ({ week: row.week, count: Number(row.count) })),
    topServices: topServices.map((row) => ({
      service: row.service ? row.service.name : 'Unknown',
      count: Number(row.count),
    })),
  };
}

// --- Visits ---

async function visitMetrics(days) {
  const from = since(days);

  const visits = await Visit.findAll({
    where: { createdAt: { [Op.gte]: from } },
    attributes: ['id', 'checkInAt', 'checkOutAt'],
    raw: true,
  });

  const completed = visits.filter((visit) => visit.checkInAt && visit.checkOutAt);
  const durations = completed.map(
    (visit) => (new Date(visit.checkOutAt) - new Date(visit.checkInAt)) / (60 * 1000)
  );

  return {
    started: visits.filter((visit) => visit.checkInAt).length,
    completed: completed.length,
    averageMinutes: durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null,
  };
}

// --- Money ---

async function revenueMetrics(days) {
  const from = since(days);

  const collected = (await Payment.sum('amount', { where: { paidAt: { [Op.gte]: from } } })) || 0;
  const invoiced = (await Invoice.sum('amount', {
    where: { issuedAt: { [Op.gte]: from }, status: { [Op.ne]: 'CANCELLED' } },
  })) || 0;

  const byMethod = await Payment.findAll({
    attributes: ['method', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
    where: { paidAt: { [Op.gte]: from } },
    group: ['method'],
    raw: true,
  });

  return {
    currency: 'TZS',
    invoiced,
    collected,
    // What was billed and not yet received in the window. Not the same
    // as the total outstanding, which the admin dashboard reports.
    uncollectedInWindow: Math.max(invoiced - collected, 0),
    byMethod: byMethod.map((row) => ({
      method: row.method,
      total: Number(row.total),
      count: Number(row.count),
    })),
  };
}

// Hide anything that could point at one household. See the note at the
// top of this file.
function suppressSmallCounts(rows, labelKey) {
  const shown = [];
  let withheldGroups = 0;
  let withheldTotal = 0;

  for (const row of rows) {
    if (row.count >= SMALL_COUNT_THRESHOLD) {
      shown.push(row);
    } else {
      withheldGroups += 1;
      withheldTotal += row.count;
    }
  }

  return {
    [labelKey]: shown,
    withheld: {
      groups: withheldGroups,
      total: withheldTotal,
      threshold: SMALL_COUNT_THRESHOLD,
      reason:
        'Vikundi vyenye idadi ndogo vimefichwa ili mtu mmoja asiweze kutambulika kutokana na takwimu hizi.',
    },
  };
}

// --- Health signals ---

async function healthMetrics(days) {
  const from = since(days);

  const symptoms = await Symptom.findAll({
    attributes: ['name', [fn('COUNT', col('id')), 'count']],
    where: { createdAt: { [Op.gte]: from } },
    group: ['name'],
    order: [[literal('count'), 'DESC']],
    limit: 20,
    raw: true,
  });

  const redFlags = await AiInteraction.count({
    where: { redFlag: true, createdAt: { [Op.gte]: from } },
  });

  const aiTotal = await AiInteraction.count({ where: { createdAt: { [Op.gte]: from } } });

  const answered = await AiInteraction.count({
    where: { outcome: 'ANSWERED', createdAt: { [Op.gte]: from } },
  });

  return {
    ...suppressSmallCounts(
      symptoms.map((row) => ({ name: row.name, count: Number(row.count) })),
      'topSymptoms'
    ),
    afyaAi: {
      questions: aiTotal,
      redFlags,
      answeredFromKnowledgeBase: answered,
      // How often the knowledge base had nothing. A high number here is
      // a content gap, not a fault.
      unanswered: aiTotal - answered - redFlags,
    },
  };
}

async function overview({ days = 30 } = {}) {
  const [bookings, visits, revenue, health] = await Promise.all([
    bookingMetrics(days),
    visitMetrics(days),
    revenueMetrics(days),
    healthMetrics(days),
  ]);

  return { periodDays: days, bookings, visits, revenue, health, generatedAt: new Date() };
}

module.exports = { overview, bookingMetrics, visitMetrics, revenueMetrics, healthMetrics, SMALL_COUNT_THRESHOLD };
