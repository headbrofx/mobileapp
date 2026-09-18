'use strict';

// Google sign-in, in the two places the schema has to give way for it.
//
// password_hash was NOT NULL, because until now every account was made
// by choosing a password. An account that signs in with Google never
// has one, and storing a random unusable hash to satisfy the column
// would be a lie in the data: it would look like a password nobody can
// guess rather than like no password at all. It becomes nullable, and
// the login path refuses an account that has none rather than comparing
// against null.
//
// google_sub is Google's own subject id — stable for the account even
// if the person changes their email address, which an email match alone
// would miss. Unique, so two accounts cannot claim the same Google
// identity.
//
// phone stays NOT NULL on purpose. It is how the office rings a client
// and how a nurse finds the house, and a home-visit service with no
// number for half its clients is a worse thing than an extra step at
// sign-up. Google sign-in asks for the number instead of dropping the
// requirement.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'google_sub', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'google_sub');

    // Going back means password_hash cannot be null again. Any account
    // created through Google has no password to put there, so this
    // would fail on real data — which is correct. Reversing this
    // migration is a decision about those accounts, not a formality.
    await queryInterface.changeColumn('users', 'password_hash', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
