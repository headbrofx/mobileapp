'use strict';

// Daily health tips, in both languages.
//
// DRAFT again, and for the same reason the reproductive-health pieces
// are: content.service keeps that gate because health writing nobody
// has read before it goes out is how bad advice reaches people at
// scale. `npm run content:publish -- tip` after a nurse has read them.
//
// These are deliberately the dullest kind of true: water, sleep, hand
// washing, salt, movement. Nothing here diagnoses anything, nothing
// tells somebody to take or stop taking anything, and nothing promises
// an outcome. A tip on a home screen is read by a person who did not
// ask a question — it has no business doing more than that.
//
// Each tip exists twice, tagged sw or en, because the app picks by the
// reader's language rather than translating on the fly.

const TIPS = [
  {
    sw: ['Maji ni dawa ya bei rahisi', 'Kunywa maji safi mara kwa mara mchana kutwa, hasa siku za joto. Usisubiri kiu — kiu ni ishara umeshachelewa kidogo.'],
    en: ['Water is the cheapest medicine', 'Drink clean water through the day, especially when it is hot. Do not wait for thirst — thirst means you are already a little behind.'],
  },
  {
    sw: ['Nawa mikono kabla ya kula', 'Sabuni na maji kwa sekunde ishirini huzuia magonjwa mengi ya tumbo kuliko dawa yoyote utakayonunua baadaye.'],
    en: ['Wash your hands before eating', 'Soap and water for twenty seconds prevents more stomach illness than any medicine you would buy afterwards.'],
  },
  {
    sw: ['Chumvi kidogo, moyo mzima', 'Punguza chumvi kwenye mapishi na epuka kuongeza mezani. Shinikizo la damu hupanda kimya kimya, bila dalili.'],
    en: ['Less salt, a healthier heart', 'Use less salt when cooking and skip the salt shaker at the table. Blood pressure rises quietly, with no symptoms.'],
  },
  {
    sw: ['Tembea dakika thelathini', 'Si lazima uende gym. Kutembea kwa mwendo wa haraka njiani au sokoni kunahesabika, na kunafanya kazi.'],
    en: ['Walk for thirty minutes', 'You do not need a gym. Walking briskly to the market or along the road counts, and it works.'],
  },
  {
    sw: ['Usingizi ni sehemu ya matibabu', 'Saa saba hadi nane kwa usiku. Mwili hujitengeneza wakati wa usingizi, si wakati wa kupumzika tu.'],
    en: ['Sleep is part of treatment', 'Seven to eight hours a night. The body repairs itself while you sleep, not merely while you rest.'],
  },
  {
    sw: ['Mboga za majani kila siku', 'Mchicha, kisamvu, matembele — nusu ya sahani yako iwe mboga na matunda. Ni rahisi kuliko dawa za vitamini.'],
    en: ['Green vegetables every day', 'Spinach, cassava leaves, sweet potato leaves — make half your plate vegetables and fruit. Cheaper than vitamin pills.'],
  },
  {
    sw: ['Pima presha hata ukiwa mzima', 'Shinikizo la damu halina dalili mwanzoni. Kupima ni dakika mbili, na kugundua mapema hubadilisha kila kitu.'],
    en: ['Check your blood pressure even when well', 'High blood pressure has no early symptoms. Checking takes two minutes, and finding it early changes everything.'],
  },
  {
    sw: ['Chandarua kila usiku', 'Malaria huzuilika. Chandarua ni rahisi kuliko matibabu, na ni salama zaidi kuliko kutegemea bahati.'],
    en: ['A mosquito net every night', 'Malaria is preventable. A net costs less than treatment and is safer than relying on luck.'],
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM content_categories WHERE slug = 'ushauri-wa-afya' LIMIT 1",
      { type: Sequelize.QueryTypes.SELECT }
    );

    let categoryId = existing?.id;
    if (!categoryId) {
      const [rows] = await queryInterface.sequelize.query(
        `INSERT INTO content_categories (id, name, slug, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Ushauri wa afya', 'ushauri-wa-afya', :now, :now)
         RETURNING id`,
        { replacements: { now } }
      );
      categoryId = rows[0].id;
    }

    const slugify = (text) =>
      text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

    for (const tip of TIPS) {
      for (const language of ['sw', 'en']) {
        const [title, body] = tip[language];
        const slug = `tip-${language}-${slugify(title)}`;

        const [clash] = await queryInterface.sequelize.query(
          'SELECT id FROM content_items WHERE slug = :slug LIMIT 1',
          { replacements: { slug }, type: Sequelize.QueryTypes.SELECT }
        );
        if (clash) continue;

        await queryInterface.sequelize.query(
          `INSERT INTO content_items
             (id, category_id, type, title, slug, body, tags, status, created_at, updated_at)
           VALUES
             (gen_random_uuid(), :categoryId, 'ARTICLE', :title, :slug, :body,
              CAST(:tags AS jsonb), 'DRAFT', :now, :now)`,
          {
            replacements: {
              categoryId,
              title,
              slug,
              body,
              tags: JSON.stringify(['tip', language]),
              now,
            },
          }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM content_items WHERE slug LIKE 'tip-%'"
    );
    await queryInterface.sequelize.query(
      "DELETE FROM content_categories WHERE slug = 'ushauri-wa-afya'"
    );
  },
};
