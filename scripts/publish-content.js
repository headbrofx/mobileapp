'use strict';

// Publish drafted articles, once somebody qualified has read them.
//
// content.service keeps DRAFT as the gate deliberately: nothing reaches
// a patient until it is published on purpose. This script is that
// purpose made convenient — it is not a way around the gate, it is the
// step after the review.
//
//   npm run content:publish -- orbit          (every draft with that tag)
//   npm run content:publish -- --list         (show what is waiting)
//
// Run it when your nurse has read them, not before.

require('dotenv').config();
const { sequelize, Content } = require('../src/models');
const { Op } = require('sequelize');

async function main() {
  const arg = process.argv[2];

  const drafts = await Content.findAll({
    where: { status: 'DRAFT' },
    order: [['createdAt', 'ASC']],
  });

  if (!arg || arg === '--list') {
    if (drafts.length === 0) {
      console.log('No drafts waiting.');
    } else {
      console.log(`${drafts.length} draft(s) waiting for review:\n`);
      drafts.forEach((item) => {
        console.log(`  ${item.slug}`);
        console.log(`    ${item.title}`);
        console.log(`    tags: ${(item.tags || []).join(', ') || '-'}\n`);
      });
      console.log('Publish a set with:  npm run content:publish -- <tag>');
    }
    await sequelize.close();
    return;
  }

  const matching = drafts.filter((item) => (item.tags || []).includes(arg));

  if (matching.length === 0) {
    console.log(`No drafts tagged "${arg}".`);
    await sequelize.close();
    return;
  }

  await Content.update(
    { status: 'PUBLISHED', publishedAt: new Date() },
    { where: { id: { [Op.in]: matching.map((item) => item.id) } } }
  );

  console.log(`Published ${matching.length} article(s) tagged "${arg}":`);
  matching.forEach((item) => console.log(`  ${item.title}`));

  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err.message);
  await sequelize.close();
  process.exit(1);
});
