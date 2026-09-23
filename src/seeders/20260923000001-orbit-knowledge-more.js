'use strict';

// The last of the ground the owner's clinical brief covers: menopause,
// contraception, sexually transmitted infections, and trying for a
// pregnancy without success.
//
// These four were left until last because they are the four where the
// brief's rules bite hardest, and where a careless sentence does the
// most damage:
//
//   - a method of contraception is never chosen for the reader. The
//     right one depends on her health, her medications, whether she is
//     breastfeeding and what she wants next, and none of that is
//     knowable from a screen
//   - nobody is told they have an infection, and nobody is judged for
//     how they might have got one. Most infections carry no symptoms
//     at all, which is the single most useful thing the entry can say
//   - not every change is menopause, and bleeding after menopause is
//     never dismissed
//   - fertility is never promised, and no day is named as the day
//
// Same shape as the other two seeders, same gate: HEALTH_EDUCATION,
// seeded unverified, invisible to search until a professional signs it
// off with `npm run knowledge:review`.

const { randomUUID } = require('crypto');

const now = new Date();
const SOURCE = 'Afya Nyumbani — Orbit knowledge (reproductive)';

const NHS = 'https://www.nhs.uk/conditions/';
const WHO = 'https://www.who.int/health-topics/';

function item({ title, content, sections, sourceUrl = NHS }) {
  return {
    id: randomUUID(),
    title,
    content,
    category: 'HEALTH_EDUCATION',
    language: 'SW',
    source: SOURCE,
    source_url: sourceUrl,
    sections: JSON.stringify(sections),
    content_version: 1,
    verified_by_professional: false,
    verified_by: null,
    verified_at: null,
    created_at: now,
    updated_at: now,
  };
}

const ROWS = [
  item({
    title: 'Kukoma hedhi na kipindi cha kuelekea huko',
    content:
      'Kukoma hedhi ni pale hedhi inaposimama kabisa. Kipindi cha kuelekea huko kinaweza kuchukua miaka kadhaa, ' +
      'na mabadiliko yake hutofautiana sana kati ya mwanamke na mwingine.',
    sections: {
      whatMayBeHappening:
        'Homoni zinazoongoza mzunguko hupungua taratibu. Katika kipindi hicho hedhi inaweza kuwa isiyo ya kawaida — ' +
        'ikija mapema, ikichelewa, ikiwa nzito au nyepesi kuliko ilivyozoeleka. Mengine yanayotajwa mara nyingi ni ' +
        'joto la ghafla mwilini, kutokwa jasho usiku, kubadilika kwa usingizi na hisia, ukavu ukeni, na mabadiliko ' +
        'ya hamu ya tendo la ndoa.',
      whatToMonitor:
        'Andika hedhi zako zinapokuja na jinsi zilivyo. Angalia pia usingizi, hisia, na joto la ghafla — ni mara ngapi ' +
        'na kwa kiasi gani vinakuathiri. Rekodi ya miezi kadhaa ndiyo picha halisi; mwezi mmoja si picha.',
      selfCare:
        'Mavazi yanayoruhusu hewa, chumba chenye ubaridi usiku, na kupunguza kahawa au pombe husaidia wengine kuhusu ' +
        'joto la ghafla. Mazoezi ya kawaida na usingizi wa kutosha husaidia hisia na mifupa. Ukavu ukeni una njia za ' +
        'kuusaidia — si kitu cha kuvumilia kimya.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama dalili zinakuzuia kufanya kazi au kulala, kama hedhi imekuwa nzito isivyo kawaida, ' +
        'au kama unataka kujua njia zilizopo za kupunguza dalili. Usidhanie kila mabadiliko ni kukoma hedhi — ' +
        'mengine yana sababu nyingine kabisa, na kupimwa ndiyo njia ya kujua.',
      whenUrgent:
        'Kutokwa damu baada ya hedhi kukoma kabisa — hata kidogo sana — kunahitaji kuonwa na mtaalamu bila kuchelewa. ' +
        'Hilo halipuuzwi kamwe. Damu nyingi isiyokoma au maumivu makali ya ghafla, nenda hospitali sasa hivi.',
    },
  }),

  item({
    title: 'Njia za uzazi wa mpango',
    content:
      'Zipo njia nyingi, na hakuna moja inayomfaa kila mtu. Inayokufaa inategemea afya yako, dawa unazotumia, ' +
      'kama unanyonyesha, na mipango yako ya baadaye.',
    sections: {
      whatMayBeHappening:
        'Njia hufanya kazi kwa namna tofauti: zingine huzuia mbegu kukutana na yai (kondomu), zingine hutumia homoni ' +
        'kuzuia yai kuachiliwa (vidonge, sindano, vipandikizi), na zingine hubadilisha mazingira ya mfuko wa uzazi ' +
        '(IUD). Kondomu pekee ndiyo hupunguza pia hatari ya magonjwa ya zinaa.',
      whatToMonitor:
        'Ukianza njia yoyote, angalia mabadiliko ya hedhi, hisia, uzito, kichwa au ngozi katika miezi mitatu ya ' +
        'mwanzo — mwili mara nyingi huhitaji muda kuzoea. Andika unachokiona ili uweze kueleza vizuri.',
      selfCare:
        'Kumbuka jinsi njia yako inavyotumika: vidonge vinataka muda uleule kila siku, sindano na vipandikizi vina ' +
        'tarehe za kurudia. Weka kikumbusho. Kalenda peke yake si njia ya uhakika — mzunguko unaweza kubadilika ' +
        'kwa msongo, ugonjwa au safari.',
      whenToSeekAdvice:
        'Ongea na mtaalamu ili kuchagua inayokufaa — hilo halifanyiki kwenye app, na yeyote anayekuchagulia bila ' +
        'kujua historia yako ya afya anakukosea. Rudi kwake pia kama njia uliyonayo inakupa shida, kama unataka ' +
        'kubadilisha, au kama unapanga kupata ujauzito.',
      whenUrgent:
        'Maumivu makali ya tumbo, maumivu ya kifua au kupumua kwa shida, maumivu au uvimbe wa mguu mmoja, au ' +
        'maumivu makali ya kichwa yasiyo ya kawaida ukiwa unatumia njia ya homoni — nenda hospitali mara moja.',
    },
  }),

  item({
    title: 'Magonjwa ya zinaa — kujikinga na kupima',
    content:
      'Magonjwa mengi ya zinaa hayana dalili zozote. Ndiyo sababu kupima ndiyo njia pekee ya kujua hali yako, ' +
      'si kusubiri kuona kitu.',
    sections: {
      whatMayBeHappening:
        'Yapo mengi — HIV, kaswende, kisonono, klamidia, trichomoniasis, HPV na malengelenge ya sehemu za siri ni ' +
        'miongoni mwa yanayotajwa mara nyingi. Mengine huletwa na bakteria na hutibika kabisa; mengine huletwa na ' +
        'virusi na husimamiwa kwa dawa. Dalili zikitokea zinaweza kufanana kati ya moja na nyingine, kwa hiyo hata ' +
        'mtaalamu hategemei maelezo — hutegemea kipimo.',
      whatToMonitor:
        'Uchafu usio wa kawaida, muwasho, vidonda, uvimbe, maumivu wakati wa kukojoa au wakati wa tendo, na maumivu ' +
        'ya tumbo la chini. Lakini kumbuka tena: kutokuwa na dalili hakumaanishi kutokuwa na maambukizi.',
      selfCare:
        'Kondomu hupunguza hatari ya mengi kati ya haya. Kupima mara kwa mara ni sehemu ya kujitunza, kama kupima ' +
        'presha — si jambo la aibu wala la kumhukumu mtu. Usijitibu kwa dawa za kununua bila kipimo; dawa isiyofaa ' +
        'inaweza kuficha tatizo au kulifanya gumu kutibu.',
      whenToSeekAdvice:
        'Nenda kupima kama una dalili, kama mwenzi wako amegundulika na maambukizi, kama umefanya tendo bila kinga, ' +
        'au kama unataka tu kujua. Mkigundulika, wote wawili mnahitaji kutibiwa — vinginevyo mnaambukizana tena. ' +
        'Uliza pia kuhusu chanjo ya HPV, ambayo hutolewa kwa baadhi ya umri.',
      whenUrgent:
        'Homa kali pamoja na maumivu ya tumbo la chini, maumivu makali ya nyonga, au vidonda vinavyozidi kwa kasi ' +
        'vinahitaji huduma bila kuchelewa. Nenda kituo cha afya kilicho karibu.',
    },
    sourceUrl: WHO,
  }),

  item({
    title: 'Kujaribu kupata ujauzito bila mafanikio',
    content:
      'Kwa wanandoa wengi ujauzito huchukua muda. Hakuna siku moja inayoweza kuahidiwa, na kushindwa kwa miezi ' +
      'michache si dalili ya tatizo.',
    sections: {
      whatMayBeHappening:
        'Uwezo wa kupata ujauzito unategemea mambo mengi kwa pande zote mbili: utoaji wa yai, umri, afya ya mbegu ' +
        'za kiume, mirija ya uzazi, mfuko wa uzazi, homoni, na hali nyingine za kiafya. Ni jambo la wawili, si la ' +
        'mwanamke pekee — na uchunguzi unapohitajika huwahusu wote wawili.',
      whatToMonitor:
        'Andika hedhi zako kwa miezi kadhaa ili uone urefu wa mzunguko wako na kama unatabirika. Angalia pia dalili ' +
        'za kutoa yai kama ute wa shingo ya kizazi. Rekodi hii ndiyo kitu cha kwanza mtaalamu atakachohitaji.',
      selfCare:
        'Mambo yanayosaidia afya kwa ujumla husaidia hapa pia: kula vizuri, kulala vya kutosha, kupunguza msongo, ' +
        'kuacha sigara na kupunguza pombe. Asidi foliki hushauriwa kwa anayepanga ujauzito. Zaidi ya hapo, epuka ' +
        'ahadi za mtu yeyote anayekuuzia uhakika — hakuna anayeweza kuuahidi.',
      whenToSeekAdvice:
        'Mwongozo unaotumika mara nyingi ni: baada ya mwaka mmoja wa kujaribu bila mafanikio, au baada ya miezi ' +
        'sita kama mwanamke ana zaidi ya miaka 35. Nenda mapema zaidi kama hedhi hazitabiriki, kama kuna maumivu ' +
        'makali ya hedhi, au kama kuna historia ya upasuaji au maambukizi ya nyonga.',
      whenUrgent:
        'Kama umepata ujauzito na unapata maumivu makali ya tumbo la chini, kutokwa damu, au kizunguzungu — nenda ' +
        'hospitali mara moja. Hizo zinaweza kuwa dalili za dharura.',
    },
  }),
];

module.exports = {
  async up(queryInterface) {
    // Idempotent by title, like the other two. These run by hand
    // against production, and a hand-run command gets run twice.
    const titles = ROWS.map((r) => r.title);
    const existing = await queryInterface.sequelize.query(
      'SELECT title FROM knowledge_items WHERE title IN (:titles)',
      {
        replacements: { titles },
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }
    );
    const have = new Set(existing.map((row) => row.title));
    const fresh = ROWS.filter((r) => !have.has(r.title));
    if (fresh.length === 0) return;

    await queryInterface.bulkInsert('knowledge_items', fresh);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('knowledge_items', { source: SOURCE });
  },
};
