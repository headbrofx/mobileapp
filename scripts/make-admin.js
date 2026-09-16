'use strict';

// Promote an existing account to ADMIN.
//
//   npm run make-admin -- 0712345678
//
// This exists because of a bootstrap problem: the role endpoint is
// ADMIN-only, so a fresh database with no admin in it has no way to
// make one through the API. Running this needs shell access and the
// database URL, which is a reasonable bar for the one account that can
// promote every other.
//
// It never creates an account and never sets a password — register
// normally first, then run this against that phone number.

const { User, sequelize } = require('../src/models');

async function main() {
  const phone = process.argv[2];

  if (!phone) {
    console.error('Usage: npm run make-admin -- <phone>');
    process.exit(1);
  }

  const user = await User.findOne({ where: { phone } });
  if (!user) {
    console.error(`No account with phone ${phone}. Register through the API first, then run this.`);
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.log(`${user.name} (${phone}) is already an ADMIN.`);
    return;
  }

  const before = user.role;
  user.role = 'ADMIN';
  if (user.status !== 'ACTIVE') user.status = 'ACTIVE';
  await user.save();

  console.log(`${user.name} (${phone}): ${before} -> ADMIN`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
