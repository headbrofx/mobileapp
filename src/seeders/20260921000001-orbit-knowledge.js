'use strict';

// Structured answers for the questions Orbit's own suggestion chips ask.
//
// These are written into knowledge_items with `sections` filled in, so
// Ask Orbit can render the six-part shape the brief describes without
// a model inventing the headings. A reviewer wrote each section; the
// app only lays them out.
//
// Every one of these is seeded UNVERIFIED and in category
// HEALTH_EDUCATION, which means knowledge.search will not return any of
// them until a professional signs them off. That is deliberate and it
// is the existing rule, not a new one: clinical material is withheld
// until somebody qualified has read it. Health writing nobody has
// checked is how bad advice reaches people at scale.
//
// So this seeder makes the feature ready, not live. `npm run
// knowledge:review -- --list` shows what is waiting; a nurse reads them
// and `npm run knowledge:review -- <id>` releases one.
//
// The content is deliberately general and non-diagnostic. It describes
// what is common, what is worth watching, and when to stop reading an
// app and talk to a person. It names no condition as a conclusion.

const { randomUUID } = require('crypto');

const now = new Date();

function item({ title, content, sections, source, sourceUrl }) {
  return {
    id: randomUUID(),
    title,
    content,
    category: 'HEALTH_EDUCATION',
    language: 'SW',
    source,
    source_url: sourceUrl,
    sections: JSON.stringify(sections),
    content_version: 1,
    // Withheld until a professional signs it off. This is the gate.
    verified_by_professional: false,
    verified_by: null,
    verified_at: null,
    created_at: now,
    updated_at: now,
  };
}

const ITEMS = [
  item({
    title: 'Maumivu ya hedhi (cramps)',
    content:
      'Maumivu ya tumbo wakati wa hedhi ni ya kawaida kwa wanawake wengi. Mara nyingi huanza siku moja kabla au siku ya kwanza ya hedhi na hupungua ndani ya siku mbili hadi tatu.',
    sections: {
      whatMayBeHappening:
        'Wakati wa hedhi, mfuko wa uzazi hujikunja ili kutoa utando wake. Mikunjo hiyo ndiyo inayosababisha maumivu unayohisi. Kwa wanawake wengi maumivu haya ni ya kawaida na hayaashirii ugonjwa.',
      whatToMonitor:
        'Angalia siku maumivu yanapoanza, yanavyodumu, na ukali wake. Angalia pia kama yanakuzuia kufanya shughuli zako za kawaida, na kama yanabadilika mwezi hadi mwezi.',
      selfCare:
        'Vitu vinavyowasaidia watu wengi: joto tumboni (chupa ya maji ya moto au kitambaa cha moto), kunywa maji ya kutosha, kupumzika, na kutembea kidogo. Dawa za maumivu za kawaida zinaweza kusaidia — fuata maelekezo ya kifurushi au uliza mfamasia.',
      whenToSeekAdvice:
        'Zungumza na mtaalamu wa afya ikiwa maumivu yanakuzuia kwenda kazini au shuleni, yamezidi kuliko ilivyokuwa kawaida yako, au hayapungui na dawa za kawaida.',
      whenUrgent:
        'Tafuta huduma haraka ikiwa una maumivu makali ya ghafla, homa kali, kutokwa damu nyingi isiyo ya kawaida, au unazimia.',
    },
    source: 'NHS — Period pain; WHO — Sexual and reproductive health',
    sourceUrl: 'https://www.nhs.uk/conditions/period-pain/',
  }),

  item({
    title: 'Hedhi kuchelewa',
    content:
      'Hedhi kuchelewa kunaweza kutokea kwa sababu nyingi. Mzunguko wa kawaida hutofautiana kati ya siku 21 na 35, na si lazima uwe sawa kila mwezi.',
    sections: {
      whatMayBeHappening:
        'Mzunguko wa hedhi hubadilika kwa sababu nyingi: msongo wa mawazo, mabadiliko ya uzito, ugonjwa, kusafiri, kunyonyesha, au kuanza au kuacha njia ya uzazi wa mpango. Ujauzito pia ni sababu inayowezekana ikiwa umeshiriki tendo la ndoa.',
      whatToMonitor:
        'Andika tarehe ya hedhi yako ya mwisho na urefu wa mizunguko yako ya karibuni. Angalia pia dalili nyingine — kichefuchefu, matiti kuuma, mabadiliko ya mwili.',
      selfCare:
        'Ikiwa unaweza kuwa mjamzito, kipimo cha ujauzito cha nyumbani kinapatikana kwenye maduka ya dawa na ni sahihi zaidi kikichukuliwa baada ya hedhi kuchelewa kwa wiki moja.',
      whenToSeekAdvice:
        'Ona mtaalamu ikiwa hedhi imechelewa zaidi ya wiki sita, imekosekana mizunguko mitatu mfululizo, au mzunguko wako umebadilika sana bila sababu unayoijua.',
      whenUrgent:
        'Tafuta huduma haraka ikiwa una maumivu makali ya tumbo la chini, kizunguzungu kikali, au kutokwa damu nyingi — hasa ikiwa kipimo cha ujauzito kilikuwa chanya.',
    },
    source: 'NHS — Stopped or missed periods; ACOG — Abnormal uterine bleeding',
    sourceUrl: 'https://www.nhs.uk/conditions/stopped-or-missed-periods/',
  }),

  item({
    title: 'Mabadiliko ya hisia kabla ya hedhi',
    content:
      'Wanawake wengi hupata mabadiliko ya hisia, uchovu au kuwashwa kwa urahisi katika siku chache kabla ya hedhi. Hii hujulikana kama dalili za kabla ya hedhi.',
    sections: {
      whatMayBeHappening:
        'Katika siku zinazotangulia hedhi, viwango vya homoni mwilini hubadilika. Watu wengi huhisi mabadiliko ya hisia, uchovu, au hamu ya vyakula fulani katika kipindi hiki. Hii ni ya kawaida na hupita hedhi ikianza.',
      whatToMonitor:
        'Andika hisia zako kila siku kwa mizunguko michache. Ukiona mfumo unaojirudia — kwa mfano hisia kushuka siku mbili au tatu kabla ya hedhi kila mwezi — hiyo ni taarifa muhimu ya kumwambia mtaalamu.',
      selfCare:
        'Usingizi wa kutosha, kutembea au mazoezi mepesi, na kula milo ya kawaida husaidia watu wengi. Kupunguza kafeini na pombe katika siku hizo kunaweza kusaidia pia.',
      whenToSeekAdvice:
        'Zungumza na mtaalamu ikiwa hisia zako zinaathiri kazi, masomo au mahusiano yako, au zinaendelea baada ya hedhi kuanza.',
      whenUrgent:
        'Tafuta msaada mara moja ikiwa una mawazo ya kujidhuru au kujiua. Hiyo si kitu cha kusubiri hedhi ijayo.',
    },
    source: 'NHS — PMS; ACOG — Premenstrual syndrome',
    sourceUrl: 'https://www.nhs.uk/conditions/pre-menstrual-syndrome/',
  }),

  item({
    title: 'Kula wakati wa hedhi',
    content:
      'Hakuna chakula kimoja kinachobadilisha mzunguko wa hedhi. Lengo ni milo ya kawaida yenye mchanganyiko mzuri, hasa siku unazopoteza damu.',
    sections: {
      whatMayBeHappening:
        'Wakati wa hedhi mwili hupoteza damu, na pamoja nayo madini ya chuma. Watu wengine huhisi uchovu zaidi katika siku hizi.',
      whatToMonitor:
        'Angalia kama uchovu wako unazidi kila mzunguko, au kama unahisi kizunguzungu unaposimama. Andika hilo — ni taarifa inayosaidia mtaalamu.',
      selfCare:
        'Vyakula vyenye madini ya chuma — maharage, dagaa, nyama, mboga za majani za kijani kibichi — husaidia mwili kurudisha kile kilichopotea. Kunywa maji ya kutosha na kula matunda na mboga. Hivi ni vyakula vinavyotoa virutubisho mwili unavyohitaji; si dawa ya kurekebisha homoni.',
      whenToSeekAdvice:
        'Ona mtaalamu ikiwa unahisi uchovu mkubwa usio wa kawaida, unaona rangi ya ngozi imebadilika, au unapata kizunguzungu mara kwa mara — vinaweza kuwa vinahitaji kipimo cha damu.',
      whenUrgent:
        'Tafuta huduma haraka ikiwa unazimia, unashindwa kupumua vizuri, au moyo unapiga kwa kasi isiyo ya kawaida.',
    },
    source: 'WHO — Anaemia; NHS — Iron in your diet',
    sourceUrl: 'https://www.who.int/health-topics/anaemia',
  }),
];

module.exports = {
  async up(queryInterface) {
    // Idempotent by title: re-running must not double the library.
    const titles = ITEMS.map((i) => i.title);
    const existing = await queryInterface.sequelize.query(
      'SELECT title FROM knowledge_items WHERE title IN (:titles)',
      {
        replacements: { titles },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );
    const have = new Set(existing.map((row) => row.title));
    const fresh = ITEMS.filter((i) => !have.has(i.title));
    if (fresh.length === 0) return;

    await queryInterface.bulkInsert('knowledge_items', fresh);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('knowledge_items', {
      title: ITEMS.map((i) => i.title),
    });
  },
};
