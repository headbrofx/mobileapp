'use strict';

// Structure for the knowledge base, and provenance for the answers
// built out of it.
//
// Ask Orbit has no language model in it. The answer a user reads is a
// vetted entry returned word for word, which is the reason it can be
// trusted and also the reason it arrived as one undifferentiated
// paragraph. The brief asks for answers shaped into "what may be
// happening / what to monitor / self-care / when to seek advice / when
// it is urgent / sources".
//
// Those sections are added to the *content*, not generated at request
// time. A model splitting a paragraph into six headings would be
// inventing the boundaries and occasionally inventing the content, and
// the one thing this feature cannot afford is a heading that says "when
// urgent care may be needed" over a sentence nobody wrote for it. A
// reviewer writes the sections; the app renders them.
//
// content_version rises whenever the text changes, so an answer given
// last month can be traced to what the entry said at the time. It does
// not version the row — that would need history tables — but it does
// mean an interaction log entry recording version 2 cannot be mistaken
// for one recording version 3.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('knowledge_items', 'sections', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment:
        'Optional structured answer: whatMayBeHappening, whatToMonitor, selfCare, whenToSeekAdvice, whenUrgent. Written by a reviewer, never generated.',
    });

    // `source` already exists and is free text — "WHO 2024", a book, a
    // conversation with a matron. A link is a different thing and
    // deserves its own column so the app can make it tappable without
    // guessing whether the text happens to be a URL.
    await queryInterface.addColumn('knowledge_items', 'source_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('knowledge_items', 'content_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    // Why the reviewer signed it off, or what they changed. Sits beside
    // verified_by and verified_at, which already exist.
    await queryInterface.addColumn('knowledge_items', 'review_note', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // How well the entry matched the question it was served for, kept
    // with the interaction rather than only in a log line. A month of
    // these is how somebody finds out the retrieval floor is set wrong.
    await queryInterface.addColumn('ai_interactions', 'confidence', {
      type: Sequelize.ENUM('HIGH', 'MEDIUM', 'LOW', 'NONE'),
      allowNull: false,
      defaultValue: 'NONE',
    });

    await queryInterface.addColumn('ai_interactions', 'match_rank', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ai_interactions', 'match_rank');
    await queryInterface.removeColumn('ai_interactions', 'confidence');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ai_interactions_confidence";');
    await queryInterface.removeColumn('knowledge_items', 'review_note');
    await queryInterface.removeColumn('knowledge_items', 'content_version');
    await queryInterface.removeColumn('knowledge_items', 'source_url');
    await queryInterface.removeColumn('knowledge_items', 'sections');
  },
};
