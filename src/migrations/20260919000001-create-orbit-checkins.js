'use strict';

// Orbit's daily body check-in.
//
// One row per person per day, and that is the only thing enforced here:
// everything else is nullable, because a check-in that demands eleven
// answers is a check-in nobody finishes. Somebody who opens Orbit, drags
// the energy slider and closes it has told us something true, and the
// row should be allowed to hold exactly that.
//
// Health history is never overwritten. The unique index is on the day,
// so editing today's entry updates today's row and yesterday's stays as
// it was recorded — updated_at carries when it was last touched, which
// is what an audit needs.
//
// The scales are 1–5 rather than 1–10 on purpose. A person can tell the
// difference between "low" and "very low"; nobody can reliably tell 6
// from 7, and a scale with more steps than the reporter can distinguish
// produces noise that later looks like a pattern.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orbit_checkins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // The day being reported on, not the moment it was typed. Someone
      // filling in last night's sleep at breakfast is describing
      // yesterday, and the pattern engine has to agree with them.
      checkin_date: { type: Sequelize.DATEONLY, allowNull: false },

      // 1 = lowest, 5 = highest. Null means "not answered", which is a
      // different thing from a low score and must stay different.
      mood: { type: Sequelize.INTEGER, allowNull: true },
      energy: { type: Sequelize.INTEGER, allowNull: true },
      sleep: { type: Sequelize.INTEGER, allowNull: true },
      appetite: { type: Sequelize.INTEGER, allowNull: true },

      // 0 = none, 5 = severe. Zero is an answer; null is silence.
      pain: { type: Sequelize.INTEGER, allowNull: true },

      flow: {
        type: Sequelize.ENUM('NONE', 'SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY'),
        allowNull: true,
      },

      // The tick-box symptoms, as a list rather than a column each, so
      // adding one is a seed change and not a migration.
      symptoms: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

      notes: { type: Sequelize.TEXT, allowNull: true },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addConstraint('orbit_checkins', {
      fields: ['family_member_id', 'checkin_date'],
      type: 'unique',
      name: 'orbit_checkins_member_date_unique',
    });

    // Every read the pattern engine makes is "this person, newest
    // first", so that is the index.
    await queryInterface.addIndex('orbit_checkins', ['family_member_id', 'checkin_date'], {
      name: 'orbit_checkins_member_date_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('orbit_checkins', 'orbit_checkins_member_date_idx');
    await queryInterface.removeConstraint('orbit_checkins', 'orbit_checkins_member_date_unique');
    await queryInterface.dropTable('orbit_checkins');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_orbit_checkins_flow";');
  },
};
