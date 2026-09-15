'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_interactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Who the question is ABOUT, which is not always who asked it — a
      // mother asking about her child. Nullable because a question about
      // opening hours is about nobody. Health data belongs to a
      // FamilyMember, never to a User.
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'SET NULL',
      },
      question: { type: Sequelize.TEXT, allowNull: false },
      answer: { type: Sequelize.TEXT, allowNull: false },
      // How the answer was produced, so a reviewer can tell an emergency
      // warning from a knowledge-base answer from a refusal.
      outcome: {
        type: Sequelize.ENUM('RED_FLAG', 'ANSWERED', 'NO_ANSWER'),
        allowNull: false,
      },
      red_flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      red_flag_categories: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      // Which knowledge items the answer came from. An answer with no
      // sources and outcome ANSWERED would be a bug worth catching.
      source_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      review_status: {
        type: Sequelize.ENUM('PENDING', 'REVIEWED_OK', 'FLAGGED_INCORRECT'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      // Not every interaction needs a human to read it, but every red
      // flag does, plus a sample of ordinary ones so review is not only
      // ever of the alarming cases.
      needs_review: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reviewer_note: { type: Sequelize.TEXT, allowNull: true },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('ai_interactions', ['user_id']);
    await queryInterface.addIndex('ai_interactions', ['needs_review', 'review_status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_interactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_interactions_outcome";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_interactions_review_status";');
  },
};
