'use strict';

// Sign off knowledge entries, once somebody qualified has read them.
//
// knowledge.search withholds anything in HEALTH_EDUCATION until
// verified_by_professional is true. That is the gate, and this script
// is the step *after* a review rather than a way around one: it records
// who signed off and when, which is what makes an answer auditable
// later.
//
//   npm run knowledge:review -- --list              what is waiting
//   npm run knowledge:review -- --show <id>         read one in full
//   npm run knowledge:review -- <id> <adminPhone>   sign one off
//   npm run knowledge:review -- --all <adminPhone>  sign off everything waiting
//
// The phone number is required for a reason. verified_by has to name a
// person, because "reviewed" with nobody behind it is worth nothing to
// the next person who has to trust it.

require('dotenv').config();
const { sequelize, KnowledgeItem, User } = require('../src/models');

function short(text, n = 90) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

async function reviewerFor(phone) {
  if (!phone) {
    console.error('A reviewer is required:  npm run knowledge:review -- <id> <adminPhone>');
    console.error('verified_by must name a person. "Reviewed" by nobody is worth nothing.');
    return null;
  }

  const user = await User.findOne({ where: { phone } });
  if (!user) {
    console.error(`No account with phone ${phone}.`);
    return null;
  }
  if (!['ADMIN', 'STAFF'].includes(user.role)) {
    console.error(`${user.name} is a ${user.role}. Only staff or an admin can sign off content.`);
    return null;
  }
  return user;
}

async function main() {
  const [command, second] = process.argv.slice(2);

  const waiting = await KnowledgeItem.findAll({
    where: { category: 'HEALTH_EDUCATION', verifiedByProfessional: false },
    order: [['createdAt', 'ASC']],
  });

  if (!command || command === '--list') {
    if (waiting.length === 0) {
      console.log('Nothing waiting for review.');
    } else {
      console.log(`${waiting.length} entr${waiting.length === 1 ? 'y' : 'ies'} waiting:\n`);
      for (const item of waiting) {
        const parts = item.sections ? Object.keys(item.sections).length : 0;
        console.log(`  ${item.id}`);
        console.log(`    ${item.title}`);
        console.log(`    ${short(item.content)}`);
        console.log(`    sections: ${parts || 'none'} · source: ${item.source ?? '-'}\n`);
      }
      console.log('Read one:   npm run knowledge:review -- --show <id>');
      console.log('Sign off:   npm run knowledge:review -- <id> <adminPhone>');
    }
    await sequelize.close();
    return;
  }

  if (command === '--show') {
    const item = await KnowledgeItem.findByPk(second);
    if (!item) {
      console.error('No entry with that id.');
      await sequelize.close();
      process.exitCode = 1;
      return;
    }
    console.log(`\n${item.title}\n${'='.repeat(item.title.length)}\n`);
    console.log(`${item.content}\n`);
    if (item.sections) {
      for (const [key, value] of Object.entries(item.sections)) {
        console.log(`--- ${key} ---\n${value}\n`);
      }
    }
    console.log(`source: ${item.source ?? '-'}`);
    console.log(`link:   ${item.sourceUrl ?? '-'}`);
    console.log(`version: ${item.contentVersion}`);
    await sequelize.close();
    return;
  }

  if (command === '--all') {
    const reviewer = await reviewerFor(second);
    if (!reviewer) {
      await sequelize.close();
      process.exitCode = 1;
      return;
    }
    for (const item of waiting) {
      item.verifiedByProfessional = true;
      item.verifiedBy = reviewer.id;
      item.verifiedAt = new Date();
      await item.save();
      console.log(`signed off: ${item.title}`);
    }
    console.log(`\n${waiting.length} entr${waiting.length === 1 ? 'y' : 'ies'} now retrievable.`);
    await sequelize.close();
    return;
  }

  const item = await KnowledgeItem.findByPk(command);
  if (!item) {
    console.error('No entry with that id. Run with --list to see what is waiting.');
    await sequelize.close();
    process.exitCode = 1;
    return;
  }

  const reviewer = await reviewerFor(second);
  if (!reviewer) {
    await sequelize.close();
    process.exitCode = 1;
    return;
  }

  item.verifiedByProfessional = true;
  item.verifiedBy = reviewer.id;
  item.verifiedAt = new Date();
  await item.save();

  console.log(`Signed off "${item.title}" as ${reviewer.name}.`);
  console.log('It is now retrievable by Ask Orbit.');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err.message);
  await sequelize.close();
  process.exitCode = 1;
});
