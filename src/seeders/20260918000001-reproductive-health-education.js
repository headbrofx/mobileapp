'use strict';

// Reproductive and sexual health education, for the Orbit screen.
//
// **These are seeded as DRAFT and that is the point.** content.service
// says it plainly: DRAFT is the gate, nothing reaches a patient until
// somebody with an admin account publishes it deliberately, because
// health writing nobody has read before it goes out is how bad advice
// reaches people at scale. That rule does not get an exception for
// material the machine wrote — if anything it matters more here.
//
// What is written below is general public-health information of the
// kind on a clinic wall: which families of methods exist, that condoms
// are the only one that also reduces infection, that emergency
// contraception is time-critical, that nobody may pressure you. It
// names no dosages, quotes no effectiveness figures as advice, and
// diagnoses nothing. Every piece ends by sending the reader to a person
// — because which method suits someone depends on their blood
// pressure, their age, whether they are breastfeeding and half a dozen
// other things an app cannot know.
//
// A nurse reads these, then `npm run content:publish -- uzazi` puts
// them in front of clients.

const CATEGORY = { name: 'Afya ya uzazi', slug: 'afya-ya-uzazi' };

const CLOSING =
  '\n\nHaya ni maelezo ya jumla, si ushauri kwa hali yako binafsi. ' +
  'Uchaguzi wa njia unategemea umri wako, afya yako, kama unanyonyesha, ' +
  'na mambo mengine ambayo app haiwezi kuyajua. Ongea na muuguzi wako ' +
  'au nenda kituo cha afya kilicho karibu nawe.';

const ARTICLES = [
  {
    title: 'Uzazi wa mpango: njia zilizopo',
    slug: 'uzazi-wa-mpango-njia-zilizopo',
    tags: ['uzazi wa mpango', 'orbit'],
    body:
      'Uzazi wa mpango ni kuamua mwenyewe kama unataka mtoto, lini, na ' +
      'kwa nafasi gani kati ya mtoto na mtoto. Ni haki yako, na ni ' +
      'uamuzi wako.\n\n' +
      'Njia zipo za aina kadhaa:\n\n' +
      '**Za homoni** — vidonge, sindano, vipandikizi vya mkononi. ' +
      'Hufanya kazi kwa kuzuia yai kupevuka au kuzuia mbegu kufika.\n\n' +
      '**Za kizuizi** — kondomu ya kiume na ya kike. Huzuia mbegu ' +
      'kufika, na hizi pekee ndizo hupunguza pia hatari ya magonjwa ya ' +
      'ngono.\n\n' +
      '**Za muda mrefu** — kitanzi (IUD) na vipandikizi. Hukaa miaka ' +
      'kadhaa na vinaweza kuondolewa wakati wowote ukitaka mtoto.\n\n' +
      '**Za kudumu** — kufunga kizazi kwa mwanamke au mwanaume. Hizi ' +
      'huchukuliwa kama za kudumu, kwa hiyo ni uamuzi wa kufikiria kwa ' +
      'kina.\n\n' +
      '**Kuhesabu siku** — kufuatilia mzunguko. Orbit inakusaidia ' +
      'kuandika, lakini kumbuka hesabu ya kalenda si ya uhakika: ' +
      'mzunguko hubadilika kwa ugonjwa, msongo, safari na kunyonyesha. ' +
      'Usiitegemee peke yake kama unataka kuzuia mimba.\n\n' +
      'Hakuna njia moja bora kwa kila mtu. Muuguzi atakueleza zipi ' +
      'zinafaa kwako na madhara yake.' +
      CLOSING,
  },
  {
    title: 'Kondomu na kujikinga na magonjwa ya ngono',
    slug: 'kondomu-na-kujikinga',
    tags: ['magonjwa ya ngono', 'kondomu', 'orbit'],
    body:
      'Njia nyingi za uzazi wa mpango huzuia mimba tu. Kondomu ndiyo ' +
      'pekee inayopunguza pia hatari ya magonjwa yanayoambukizwa kwa ' +
      'ngono — ikiwemo VVU, kaswende, kisonono na klamidia.\n\n' +
      'Kwa sababu hiyo watu wengi hutumia njia mbili kwa pamoja: moja ' +
      'ya kuzuia mimba, na kondomu kwa ajili ya kinga ya magonjwa.\n\n' +
      'Mambo ya msingi:\n\n' +
      '- Angalia tarehe ya mwisho wa matumizi kabla ya kuitumia.\n' +
      '- Fungua pakiti kwa mikono, si kwa meno.\n' +
      '- Tumia mpya kila tendo. Isitumike mara mbili.\n' +
      '- Usitumie mbili kwa pamoja — hujikwaruza na kupasuka.\n' +
      '- Hifadhi mahali pasipo joto kali.\n\n' +
      'Magonjwa mengi ya ngono hayana dalili mwanzoni. Mtu anaweza ' +
      'kuwa nayo bila kujua, na bado akaambukiza. Ndiyo maana upimaji ' +
      'ni muhimu hata ukijisikia mzima.' +
      CLOSING,
  },
  {
    title: 'Kuzuia mimba baada ya tendo',
    slug: 'kuzuia-mimba-baada-ya-tendo',
    tags: ['uzazi wa mpango', 'dharura', 'orbit'],
    body:
      'Ikiwa umefanya tendo bila kinga, au kondomu imepasuka, au ' +
      'umelazimishwa — kuna njia za dharura za kuzuia mimba.\n\n' +
      'Jambo muhimu zaidi: **ni suala la muda.** Njia hizi hufanya kazi ' +
      'vizuri zaidi mapema zinapotumika, na uwezo wake hupungua kila ' +
      'siku inayopita. Usisubiri uone kama hedhi itakuja.\n\n' +
      'Nenda kituo cha afya au duka la dawa haraka iwezekanavyo, au ' +
      'piga simu muuguzi wako. Watakueleza njia ipi inafaa na ndani ya ' +
      'muda gani.\n\n' +
      'Kama umelazimishwa kufanya tendo, hilo ni kosa la jinai. Zaidi ' +
      'ya kuzuia mimba, kituo cha afya kinaweza kukupa dawa za kuzuia ' +
      'VVU na kukusaidia kwa hatua nyingine. Hukustahili kupitia hilo, ' +
      'na si kosa lako.' +
      CLOSING,
  },
  {
    title: 'Afya ya hedhi: nini ni kawaida na lini uone muuguzi',
    slug: 'afya-ya-hedhi',
    tags: ['hedhi', 'orbit'],
    body:
      'Mizunguko hutofautiana kati ya mtu na mtu, na hata kwa mtu ' +
      'mmoja hubadilika. Kuchelewa au kutangulia kwa siku chache mara ' +
      'nyingi si tatizo. Msongo, ugonjwa, safari, kupungua au ' +
      'kuongezeka uzito na kunyonyesha vyote huathiri.\n\n' +
      'Usafi wakati wa hedhi:\n\n' +
      '- Badilisha pedi au kitambaa kila baada ya saa nne hadi sita.\n' +
      '- Ukitumia kitambaa, kioshe kwa sabuni na kikaushe kwenye jua.\n' +
      '- Nawa mikono kabla na baada ya kubadilisha.\n\n' +
      'Ona muuguzi au nenda kituo cha afya kama:\n\n' +
      '- Damu ni nyingi kiasi cha kulowesha pedi ndani ya saa moja, ' +
      'mfululizo.\n' +
      '- Maumivu ni makali kiasi cha kukuzuia kufanya kazi zako za ' +
      'kawaida.\n' +
      '- Hedhi imekoma miezi mitatu bila sababu unayoijua.\n' +
      '- Damu inatoka kati ya mizunguko, au baada ya tendo.\n' +
      '- Kuna harufu isiyo ya kawaida au muwasho.\n\n' +
      'Hizi si dalili za kujitibu mwenyewe — ni sababu za kuonana na ' +
      'mtu aliyesomea.' +
      CLOSING,
  },
  {
    title: 'Ridhaa na mahusiano salama',
    slug: 'ridhaa-na-mahusiano-salama',
    tags: ['ridhaa', 'orbit'],
    body:
      'Ridhaa ina maana ya kukubali kwa hiari, ukiwa na taarifa ' +
      'kamili, na ukiwa na uwezo wa kukataa bila kuogopa.\n\n' +
      '- Ridhaa hutolewa kila mara, si mara moja kwa siku zote. ' +
      'Kukubali jana hakumaanishi kukubali leo.\n' +
      '- Unaweza kubadilisha mawazo wakati wowote, hata katikati.\n' +
      '- Kimya si ridhaa. Woga si ridhaa. Kulewa si ridhaa.\n' +
      '- Kuwa kwenye ndoa au uhusiano hakuondoi haja ya ridhaa.\n\n' +
      'Mtu anayekulazimisha, anayekutisha, au anayekataa kutumia ' +
      'kinga wakati umeomba — huo si uhusiano salama, na hauko ' +
      'peke yako.\n\n' +
      'Ukihitaji msaada, ongea na muuguzi wako, nenda kituo cha afya, ' +
      'au wasiliana na dawati la jinsia la kituo cha polisi. Taarifa ' +
      'unazotoa kwa mtoa huduma wa afya ni siri.' +
      CLOSING,
  },
  {
    title: 'Upimaji: kwa nini hata ukiwa mzima',
    slug: 'upimaji-afya-ya-uzazi',
    tags: ['upimaji', 'magonjwa ya ngono', 'orbit'],
    body:
      'Magonjwa mengi ya ngono hukaa muda mrefu bila dalili yoyote. ' +
      'Mtu hujisikia mzima kabisa huku akiwa nayo — na bado ' +
      'anaambukiza, na bado yanaweza kuathiri uwezo wa kupata mtoto ' +
      'baadaye.\n\n' +
      'Upimaji ni wa haraka na wa siri. Fikiria kupima:\n\n' +
      '- Unapoanza uhusiano mpya.\n' +
      '- Baada ya tendo lolote bila kinga.\n' +
      '- Ukipanga kupata mimba — wewe na mwenzi wako.\n' +
      '- Mara kwa mara, hata bila sababu maalum.\n\n' +
      'Kupima si shutuma wala aibu. Ni sawa na kupima presha: ' +
      'unajua ulipo, na ukigundua mapema matibabu ni rahisi zaidi.\n\n' +
      'Muuguzi wa Afya Nyumbani anaweza kukueleza wapi pa kupima ' +
      'karibu nawe.' +
      CLOSING,
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [existingCategory] = await queryInterface.sequelize.query(
      'SELECT id FROM content_categories WHERE slug = :slug LIMIT 1',
      { replacements: { slug: CATEGORY.slug }, type: Sequelize.QueryTypes.SELECT }
    );

    let categoryId = existingCategory?.id;

    if (!categoryId) {
      const [rows] = await queryInterface.sequelize.query(
        `INSERT INTO content_categories (id, name, slug, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :slug, :now, :now)
         RETURNING id`,
        { replacements: { ...CATEGORY, now } }
      );
      categoryId = rows[0].id;
    }

    for (const article of ARTICLES) {
      const [clash] = await queryInterface.sequelize.query(
        'SELECT id FROM content_items WHERE slug = :slug LIMIT 1',
        { replacements: { slug: article.slug }, type: Sequelize.QueryTypes.SELECT }
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
            title: article.title,
            slug: article.slug,
            body: article.body,
            tags: JSON.stringify(article.tags),
            now,
          },
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM content_items WHERE slug IN (:slugs)`,
      { replacements: { slugs: ARTICLES.map((a) => a.slug) } }
    );
    await queryInterface.sequelize.query(
      'DELETE FROM content_categories WHERE slug = :slug',
      { replacements: { slug: CATEGORY.slug } }
    );
  },
};
