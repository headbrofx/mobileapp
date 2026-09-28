'use strict';

const { Op } = require('sequelize');
const { OrbitCheckin, MenstrualCycle, sequelize } = require('../models');
const { logAudit } = require('./audit.service');

// What Orbit remembers, in a copy, and how to make it forget.
//
// The privacy policy already promises four rights — to see what is
// held, to correct it, to have a copy, and to ask for deletion — and
// until now the only way to use any of them was to email the business
// and wait. For a module that holds a woman's periods, her moods and
// her pain scores, that gap is the wrong way round: the more intimate
// the data, the less it should depend on somebody answering an email.
//
// Three things live here, and the third is the one that needed the
// most care.
//
// --- Seeing ---
//
// Counts and date ranges, not a vague reassurance. "Umeandika mara 43
// tangu 12 Julai" is something a person can check against her own
// memory; "tunahifadhi taarifa zako kwa usalama" is not.
//
// --- A copy ---
//
// Her rows, as they are, in a shape a machine can read. No
// summarising, no interpretation — the point of a copy is that it is
// the thing itself.
//
// --- Forgetting ---
//
// Only what she wrote about herself. Check-ins and cycles are
// self-tracked: nobody else recorded them, no invoice depends on them,
// no nurse wrote a clinical note against them. They are hers and they
// can go.
//
// Bookings, visits, invoices and health measurements are deliberately
// NOT here. Those are records of a service the business delivered,
// they carry obligations that outlive an app preference, and the
// policy says so. Offering a button that quietly left them behind
// would be a worse lie than not offering one.
//
// The deletion is hard, not a flag. A "deleted" row that is still in
// the table is the kind of promise that gets a health company into
// trouble, and it is not what anybody means by delete.

async function subjectOf(familyMemberId) {
  return { familyMemberId };
}

// --- What is held ------------------------------------------------------

async function summary(familyMemberId) {
  const [checkins, cycles] = await Promise.all([
    OrbitCheckin.findAll({
      where: { familyMemberId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MIN', sequelize.col('checkin_date')), 'first'],
        [sequelize.fn('MAX', sequelize.col('checkin_date')), 'last'],
      ],
      raw: true,
    }),
    MenstrualCycle.findAll({
      where: { familyMemberId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('MIN', sequelize.col('cycle_start_date')), 'first'],
        [sequelize.fn('MAX', sequelize.col('cycle_start_date')), 'last'],
      ],
      raw: true,
    }),
  ]);

  const shape = (row) => ({
    count: Number(row?.count ?? 0),
    firstRecorded: row?.first ?? null,
    lastRecorded: row?.last ?? null,
  });

  const dailyCheckins = shape(checkins[0]);
  const cycleRecords = shape(cycles[0]);

  return {
    dailyCheckins,
    cycleRecords,

    // Named so a reader can see there is no fifth thing being kept
    // quiet. Each entry says what it is, in her words, not the column
    // name.
    fields: {
      dailyCheckins: [
        'Tarehe',
        'Hisia, nguvu, usingizi, hamu ya kula (1-5)',
        'Maumivu (0-5)',
        'Kiasi cha damu',
        'Dalili ulizochagua',
        'Maelezo uliyoandika',
      ],
      cycleRecords: [
        'Tarehe ya kuanza na kuisha',
        'Kiasi cha damu',
        'Dalili na hisia',
        'Makadirio ya mzunguko ujao',
        'Maelezo uliyoandika',
      ],
    },

    // Said plainly rather than left to be inferred from the policy.
    notKept: [
      'Mahali ulipo — hatufuatilii eneo lako',
      'Anwani ya IP kwenye maandiko ya Orbit',
      'Taarifa zako hazitumwi kwa kampuni nyingine yoyote',
    ],

    deletable: dailyCheckins.count + cycleRecords.count,
  };
}

// --- A copy ------------------------------------------------------------

async function exportData(familyMemberId) {
  const [checkins, cycles] = await Promise.all([
    OrbitCheckin.findAll({
      where: { familyMemberId },
      order: [['checkinDate', 'ASC']],
    }),
    MenstrualCycle.findAll({
      where: { familyMemberId },
      order: [['cycleStartDate', 'ASC']],
    }),
  ]);

  return {
    // Stamped so a copy taken twice can be told apart, and so she can
    // see how old the one in her hand is.
    exportedAt: new Date().toISOString(),
    subject: { familyMemberId },
    dailyCheckins: checkins.map((row) => row.toJSON()),
    cycleRecords: cycles.map((row) => row.toJSON()),
  };
}

// --- Forgetting --------------------------------------------------------

const SCOPES = {
  // Each scope names exactly what it removes. There is no "everything"
  // scope, because everything is not hers to remove — see the note at
  // the top.
  CHECKINS: 'CHECKINS',
  CYCLES: 'CYCLES',
  ORBIT: 'ORBIT',
};

async function forget(familyMemberId, scope, { userId, req } = {}) {
  if (!Object.values(SCOPES).includes(scope)) {
    const err = new Error('Unknown scope');
    err.status = 400;
    throw err;
  }

  const wants = {
    checkins: scope === SCOPES.CHECKINS || scope === SCOPES.ORBIT,
    cycles: scope === SCOPES.CYCLES || scope === SCOPES.ORBIT,
  };

  // One transaction, so a half-forgotten history cannot happen: either
  // both tables are cleared or neither is.
  const removed = await sequelize.transaction(async (transaction) => {
    const counts = { dailyCheckins: 0, cycleRecords: 0 };

    if (wants.checkins) {
      counts.dailyCheckins = await OrbitCheckin.destroy({
        where: { familyMemberId },
        transaction,
      });
    }
    if (wants.cycles) {
      counts.cycleRecords = await MenstrualCycle.destroy({
        where: { familyMemberId },
        transaction,
      });
    }

    return counts;
  });

  // Audited, but without a trace of what was deleted.
  //
  // That distinction matters here more than anywhere else in this
  // system. The business needs to be able to show that a deletion was
  // asked for and carried out; it must not keep a shadow copy of the
  // thing somebody asked it to forget. So: who, when, which scope, how
  // many rows — and nothing about what was in them.
  await logAudit({
    userId,
    action: 'ORBIT_DATA_DELETED',
    entityType: 'FamilyMember',
    entityId: familyMemberId,
    req,
    metadata: { scope, ...removed },
  });

  return removed;
}

module.exports = { summary, exportData, forget, SCOPES, subjectOf };
