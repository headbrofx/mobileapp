'use strict';

// The rest of the questions women actually ask Orbit, in the six-part
// shape, plus the two business facts the customer-service side was
// missing.
//
// These come from the owner's clinical brief. The brief is written as
// a system prompt for a language model; this app has no model. It
// answers from knowledge_items that a professional has signed off, and
// a rule engine that runs before any of it. So the brief lands here
// instead: as text somebody can read, correct and put their name to.
//
// That is the slower path and the better one. A model asked to be
// careful is still generating; an entry in this table was written
// once, read by a nurse once, and says the same thing to the hundredth
// woman as to the first.
//
// Every HEALTH_EDUCATION row is seeded UNVERIFIED and will not be
// returned by knowledge.search until somebody qualified releases it
// (`npm run knowledge:review -- --list`). The two COMPANY_INFO rows are
// business facts and are not gated — that distinction is in the query
// itself, not here.
//
// House rules followed throughout, from the brief:
//   - nothing is named as a conclusion; conditions appear as things
//     that "can" explain a symptom, never as what somebody has
//   - no cycle is described as a 28-day rule
//   - no "safe days" are promised, because a cycle can shift
//   - emergency contraception is distinguished from abortion care
//   - no contraceptive method is chosen for the reader
//   - nobody is judged for sex, pregnancy or contraception
//   - "when it is urgent" always ends by sending the reader out of the
//     app, because that section is the only one that matters when it
//     applies

const { randomUUID } = require('crypto');

const now = new Date();
const SOURCE = 'Afya Nyumbani — Orbit knowledge (expanded)';

// General patient-education references. A reviewer is expected to
// check each entry against these and replace the citation with
// whatever they actually verified it against.
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

function fact({ title, content }) {
  return {
    id: randomUUID(),
    title,
    content,
    category: 'COMPANY_INFO',
    language: 'SW',
    source: SOURCE,
    source_url: null,
    sections: null,
    content_version: 1,
    verified_by_professional: false,
    verified_by: null,
    verified_at: null,
    created_at: now,
    updated_at: now,
  };
}

const ITEMS = [
  item({
    title: 'Lini kufanya kipimo cha ujauzito',
    content:
      'Kama hedhi imechelewa na kuna uwezekano wa ujauzito, kipimo cha ujauzito kinaweza kusaidia. ' +
      'Vipimo vingi vya mkojo hutoa jibu la kuaminika zaidi kuanzia siku ya kwanza ambayo hedhi ilipaswa kuja.',
    sections: {
      whatMayBeHappening:
        'Ujauzito ni mojawapo ya sababu za hedhi kuchelewa, lakini si pekee. Msongo wa mawazo, mabadiliko ya uzito, ' +
        'mazoezi mengi, mabadiliko ya homoni, kunyonyesha, ugonjwa, baadhi ya dawa, na hali kama PCOS au tatizo la ' +
        'tezi dume la shingo (thyroid) zote zinaweza kuchelewesha hedhi.',
      whatToMonitor:
        'Kumbuka hedhi yako ya mwisho ilikuwa lini, na mzunguko wako huwa wa siku ngapi kwa kawaida. ' +
        'Angalia pia kama kuna damu kidogo isiyo ya kawaida, maumivu, au dalili nyingine mpya.',
      selfCare:
        'Fanya kipimo asubuhi, kwa mkojo wa kwanza — hapo homoni huwa nyingi zaidi. Fuata maelekezo ya kifurushi. ' +
        'Kama jibu ni hasi lakini hedhi bado haijaja baada ya wiki moja, unaweza kurudia kipimo.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama jibu ni hasi mara kwa mara lakini hedhi haiji, kama hedhi imechelewa zaidi ya miezi ' +
        'mitatu, au kama una wasiwasi kuhusu jibu ulilopata. Hakuna app inayoweza kuthibitisha kwamba ujauzito haupo — hilo linahitaji mtaalamu.',
      whenUrgent:
        'Kama una maumivu makali ya tumbo la chini, kutokwa damu, kizunguzungu au kuzimia, na kuna uwezekano wa ' +
        'ujauzito — nenda hospitali sasa hivi. Hizi zinaweza kuwa dalili za mimba nje ya kizazi, ambayo ni dharura.',
    },
  }),

  item({
    title: 'Hedhi yenye damu nyingi kupita kiasi',
    content:
      'Damu nyingi wakati wa hedhi ni jambo la kawaida kuulizwa, na kiasi hutofautiana kati ya mwanamke na mwingine. ' +
      'Kinachohitaji uangalizi ni pale kiasi kinapobadilika sana, au kinapoathiri maisha yako ya kila siku.',
    sections: {
      whatMayBeHappening:
        'Damu nyingi inaweza kuhusishwa na mabadiliko ya homoni, uvimbe kwenye mfuko wa uzazi (fibroids), ' +
        'adenomyosis, endometriosis, baadhi ya njia za uzazi wa mpango, matatizo ya kuganda kwa damu, au hali ' +
        'zinazohusiana na ujauzito. Sababu haiwezi kujulikana bila uchunguzi.',
      whatToMonitor:
        'Hedhi inachukua siku ngapi. Unabadilisha pedi au tamponi mara ngapi kwa siku. Kama kuna mabonge makubwa ya damu. ' +
        'Kama unahisi kizunguzungu, uchovu usio wa kawaida, au kupumua kwa shida. Na hii ilianza lini — ni jambo jipya au la muda mrefu.',
      selfCare:
        'Kunywa maji ya kutosha na pumzika wakati unahitaji. Vyakula vyenye madini ya chuma — maharage, mboga za majani ' +
        'za kijani, nyama — vinaweza kusaidia mwili kurudisha ulichopoteza. Andika kiasi unachokiona; ni taarifa muhimu ' +
        'zaidi utakayompa mtaalamu.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama unabadilisha pedi kila saa kwa masaa kadhaa, kama hedhi inazidi siku saba, kama kuna ' +
        'mabonge makubwa mara kwa mara, au kama umeanza kuhisi uchovu na kizunguzungu. Damu nyingi ya muda mrefu ' +
        'inaweza kupunguza damu mwilini, na hilo linatibika.',
      whenUrgent:
        'Damu nyingi pamoja na kizunguzungu kikali, kuzimia, kupumua kwa shida au udhaifu wa ghafla ni dharura. ' +
        'Nenda kituo cha afya kilicho karibu sasa hivi — usisubiri ziara ya nyumbani.',
    },
  }),

  item({
    title: 'Uchafu ukeni wenye harufu au mabadiliko',
    content:
      'Uchafu ukeni ni wa kawaida, na hubadilika katika mzunguko wa hedhi. Kinachohitaji uangalizi ni mabadiliko ' +
      'ya harufu, rangi, au kuambatana na muwasho na maumivu.',
    sections: {
      whatMayBeHappening:
        'Uchafu wa kawaida hubadilika kutokana na mzunguko wa hedhi, siku za uzazi, mabadiliko ya homoni na ujauzito. ' +
        'Mabadiliko ya harufu au rangi yanaweza kuhusishwa na maambukizi mbalimbali. Aina ya maambukizi haiwezi ' +
        'kujulikana kwa maelezo pekee — inahitaji kipimo.',
      whatToMonitor:
        'Rangi, harufu, kiasi, na kama kuna muwasho, kuungua, maumivu ya tumbo la chini, au maumivu wakati wa kukojoa. ' +
        'Angalia pia kama kilianza baada ya kubadilisha sabuni, njia ya uzazi wa mpango, au baada ya kujamiiana.',
      selfCare:
        'Osha kwa maji tu kwa nje; usitumie sabuni kali, manukato, au kuosha ndani ya uke — hivyo huvuruga uwiano wa ' +
        'asili na mara nyingi hufanya hali kuwa mbaya zaidi. Vaa nguo za ndani za pamba.',
      whenToSeekAdvice:
        'Nenda kupimwa kama kuna harufu kali isiyo ya kawaida, rangi ya kijani, njano au kijivu, muwasho, kuungua, ' +
        'maumivu ya nyonga, au maumivu wakati wa kukojoa. Maambukizi mengi yanatibika vizuri yakijulikana, na kupima ' +
        'ndiyo njia pekee ya kujua ni lipi.',
      whenUrgent:
        'Nenda hospitali haraka kama kuna homa pamoja na maumivu makali ya tumbo la chini, au kama uchafu wenye harufu ' +
        'mbaya umeanza baada ya kujifungua au baada ya upasuaji.',
    },
  }),

  item({
    title: 'Siku za uzazi na kutoa yai (ovulation)',
    content:
      'Kutoa yai ni pale kokwa la uzazi linapoachilia yai. Kwa wanawake wengi hutokea katikati ya mzunguko, ' +
      'lakini muda wake unaweza kubadilika mwezi hadi mwezi.',
    sections: {
      whatMayBeHappening:
        'Baada ya hedhi, mwili huandaa yai. Yai linapoachiliwa, baadhi ya wanawake huhisi maumivu kidogo upande mmoja ' +
        'wa tumbo la chini, huona ute mwepesi unaonata kama yai bichi, au huhisi mabadiliko ya hamu.',
      whatToMonitor:
        'Andika siku ya kwanza ya kila hedhi. Baada ya miezi michache utaona urefu wa mzunguko wako na kama unabadilika. ' +
        'Ute wa shingo ya kizazi na joto la mwili asubuhi ni dalili nyingine watu hufuatilia.',
      selfCare:
        'Kufuatilia mzunguko kunakusaidia kujielewa. Lakini kalenda peke yake si njia ya uhakika ya kuzuia mimba: ' +
        'mzunguko unaweza kubadilika kwa sababu ya msongo, ugonjwa au safari, na mbegu za kiume zinaweza kuishi ' +
        'kwa siku kadhaa mwilini.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama mzunguko wako hauko sawa mara kwa mara, kama unataka kupata ujauzito na haujafanikiwa ' +
        'kwa muda, au kama unataka njia ya uzazi wa mpango inayokufaa. Njia inayofaa inategemea afya yako, dawa ' +
        'unazotumia, kama unanyonyesha, na mipango yako — si jambo la kuchagua kwenye app.',
      whenUrgent:
        'Maumivu makali ya ghafla ya tumbo la chini, hasa yakiambatana na kizunguzungu au kuzimia, yanahitaji ' +
        'huduma ya dharura mara moja.',
    },
  }),

  item({
    title: 'Hedhi kurudi baada ya kujifungua',
    content:
      'Muda wa hedhi kurudi baada ya kujifungua hutofautiana sana, hasa kwa mama anayenyonyesha. ' +
      'Kwa wengine ni wiki chache, kwa wengine ni miezi kadhaa.',
    sections: {
      whatMayBeHappening:
        'Kunyonyesha huathiri homoni zinazoongoza mzunguko, kwa hiyo mama anayenyonyesha sana mara nyingi hukaa ' +
        'muda mrefu zaidi kabla hedhi haijarudi. Hedhi za mwanzo zinaweza kuwa nzito au nyepesi kuliko ulivyozoea, ' +
        'na zisiwe za kawaida kwa miezi michache.',
      whatToMonitor:
        'Andika hedhi zinapoanza kurudi na jinsi zilivyo. Angalia pia damu ya baada ya kujifungua (lochia) — ' +
        'hiyo ni tofauti na hedhi, na hupungua taratibu katika wiki za mwanzo.',
      selfCare:
        'Pumzika kadri unavyoweza, kunywa maji, na kula vizuri — mwili unapona na kunyonyesha kwa wakati mmoja. ' +
        'Hakuna kitu unachopaswa kufanya ili kuharakisha hedhi kurudi.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama damu ilipungua kisha ikarudi kwa wingi, kama hedhi haijarudi na huna uhakika kuhusu ' +
        'ujauzito, au kama unataka kuanza njia ya uzazi wa mpango baada ya kujifungua.',
      whenUrgent:
        'Damu nyingi, homa, maumivu makali ya tumbo, uchafu wenye harufu mbaya, maumivu makali ya kichwa pamoja na ' +
        'kutoona vizuri, au udhaifu mkubwa baada ya kujifungua — nenda hospitali mara moja.',
    },
  }),

  item({
    title: 'Kunyonyesha na uwezekano wa kupata mimba',
    content:
      'Ndiyo, inawezekana kupata ujauzito ukiwa unanyonyesha — hata kama hedhi bado haijarudi.',
    sections: {
      whatMayBeHappening:
        'Kunyonyesha hupunguza uwezekano wa kutoa yai, lakini hakuuzuii kabisa. Yai linaweza kuachiliwa kabla ya ' +
        'hedhi ya kwanza kurudi, ambayo ina maana mwanamke anaweza kupata ujauzito kabla hajaona dalili yoyote ' +
        'kwamba mzunguko umerudi.',
      whatToMonitor:
        'Angalia mabadiliko ya mwili: kichefuchefu, matiti kuuma kwa namna mpya, uchovu usio wa kawaida. ' +
        'Kumbuka pia mara ngapi na kwa muda gani mtoto ananyonya, kwa sababu hilo huathiri homoni.',
      selfCare:
        'Kama hutaki ujauzito kwa sasa, tumia njia ya uzazi wa mpango badala ya kutegemea kunyonyesha. ' +
        'Njia zipo zinazofaa kwa mama anayenyonyesha.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kuchagua njia inayofaa wakati wa kunyonyesha — baadhi ya njia zinafaa zaidi kuliko nyingine ' +
        'katika kipindi hiki, na chaguo linategemea afya yako na mipango yako. Ongea naye pia kama unahisi una ujauzito.',
      whenUrgent:
        'Maumivu makali ya tumbo la chini pamoja na kutokwa damu au kizunguzungu yanahitaji huduma ya dharura, ' +
        'hata kama unanyonyesha na hedhi haijarudi.',
    },
  }),

  item({
    title: 'Maumivu wakati wa kujamiiana',
    content:
      'Maumivu wakati wa kujamiiana ni jambo la kawaida kutokea na si kitu cha kuona aibu kuuliza. ' +
      'Yana sababu nyingi, na nyingi zinatibika.',
    sections: {
      whatMayBeHappening:
        'Yanaweza kuhusishwa na ukavu wa uke, mabadiliko ya homoni (ikiwemo baada ya kujifungua, wakati wa ' +
        'kunyonyesha au kipindi cha kukoma hedhi), maambukizi, endometriosis, uvimbe, misuli ya nyonga kukaza, ' +
        'au kupona baada ya kujifungua. Chanzo hakiwezi kujulikana bila uchunguzi.',
      whatToMonitor:
        'Maumivu yapo wapi — mwanzoni mwa uke au ndani zaidi. Yalianza lini. Yanatokea kila mara au mara chache. ' +
        'Kama kuna damu baadaye, uchafu usio wa kawaida, au maumivu yanayoendelea baada ya tendo.',
      selfCare:
        'Muda zaidi na kulainisha kunaweza kusaidia pale sababu ni ukavu. Kama kuna maumivu, hakuna sababu ya ' +
        'kuendelea — mwili unakuambia kitu. Kuongea na mwenzi wako kuhusu hili ni sehemu ya matibabu, si nje yake.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama maumivu yanajirudia, kama yameanza hivi karibuni bila sababu unayoijua, au kama ' +
        'yanaambatana na damu au uchafu usio wa kawaida. Hii ni dalili inayostahili uchunguzi, si kitu cha kuvumilia.',
      whenUrgent:
        'Maumivu makali ya ghafla ya tumbo la chini, au damu nyingi, vinahitaji huduma ya dharura mara moja.',
    },
  }),

  item({
    title: 'Kutokwa damu baada ya kujamiiana',
    content:
      'Kutokwa damu baada ya kujamiiana ni dalili inayostahili kuchunguzwa, hata kama ni kidogo na haina maumivu.',
    sections: {
      whatMayBeHappening:
        'Inaweza kuhusishwa na ukavu au mkwaruzo mdogo, maambukizi, mabadiliko kwenye shingo ya kizazi, uvimbe, ' +
        'au mabadiliko ya homoni. Mara nyingi sababu si mbaya, lakini hilo linajulikana baada ya uchunguzi — si kabla.',
      whatToMonitor:
        'Kiasi cha damu na rangi yake. Kama inatokea kila mara au mara moja. Kama kuna maumivu, uchafu usio wa ' +
        'kawaida, au damu kati ya hedhi. Kumbuka pia mara ya mwisho ulipopimwa shingo ya kizazi.',
      selfCare:
        'Hakuna tiba ya nyumbani inayofaa hapa, na hiyo ndiyo hoja: hii ni dalili ya kupimwa, si ya kujitibu. ' +
        'Andika inavyotokea ili uwe na taarifa sahihi utakapoonana na mtaalamu.',
      whenToSeekAdvice:
        'Panga kuonana na mtaalamu hata kama imetokea mara moja tu. Uchunguzi ni wa haraka, na kama kuna kitu ' +
        'kinachohitaji matibabu, kukigundua mapema hurahisisha kila kitu.',
      whenUrgent:
        'Damu nyingi isiyokoma, au damu pamoja na maumivu makali, kizunguzungu au kuzimia — nenda hospitali sasa hivi.',
    },
  }),

  item({
    title: 'Uzazi wa mpango wa dharura',
    content:
      'Uzazi wa mpango wa dharura ni njia ya kupunguza uwezekano wa ujauzito baada ya kujamiiana bila kinga. ' +
      'Si dawa ya kutoa mimba — ni tofauti na hiyo kabisa.',
    sections: {
      whatMayBeHappening:
        'Njia za dharura hufanya kazi kwa kuchelewesha au kuzuia kutoa yai. Zinafanya kazi vizuri zaidi zikitumika ' +
        'mapema iwezekanavyo baada ya tukio. Zipo aina zaidi ya moja, na zinatofautiana kwa muda ambao bado ' +
        'zinafaa kutumika.',
      whatToMonitor:
        'Kumbuka tendo lilitokea lini — saa na siku — kwa sababu hilo ndilo linaloamua njia ipi bado inafaa. ' +
        'Baada ya kutumia, angalia hedhi yako inayofuata; inaweza kuja mapema au kuchelewa kidogo.',
      selfCare:
        'Nenda kwa mfamasia au kituo cha afya haraka iwezekanavyo — muda ni muhimu hapa. Uzazi wa mpango wa dharura ' +
        'haukukingi dhidi ya magonjwa ya zinaa, kwa hiyo kupima kunaweza kuwa jambo la kufikiria pia.',
      whenToSeekAdvice:
        'Mfamasia au mtaalamu wa afya ndiye wa kukuambia njia ipi inakufaa kulingana na muda uliopita, uzito wako, ' +
        'dawa unazotumia na kama unanyonyesha. Ongea naye pia kuhusu njia ya kudumu zaidi kama hutaki ujauzito ' +
        'kwa sasa — hili halina hukumu yoyote.',
      whenUrgent:
        'Kama hedhi haijaja baada ya wiki tatu, fanya kipimo cha ujauzito. Maumivu makali ya tumbo la chini ' +
        'pamoja na damu au kizunguzungu ni dharura — nenda hospitali mara moja.',
    },
  }),

  item({
    title: 'PCOS ni nini na dalili zake',
    content:
      'PCOS (polycystic ovary syndrome) ni hali inayohusiana na homoni na inayoathiri mzunguko wa hedhi. ' +
      'Haiwezi kuthibitishwa kwa dalili pekee — inahitaji uchunguzi na vipimo.',
    sections: {
      whatMayBeHappening:
        'Katika PCOS, uwiano wa homoni hubadilika kwa namna inayoathiri utoaji wa yai. Hiyo inaweza kufanya mzunguko ' +
        'usiwe wa kawaida. Dalili zinazotajwa mara nyingi ni hedhi zisizo za kawaida au kukosekana, chunusi, ' +
        'nywele nyingi usoni au mwilini, na ugumu wa kupata ujauzito. Si kila mwenye dalili hizi ana PCOS, na ' +
        'si kila mwenye PCOS ana dalili zote.',
      whatToMonitor:
        'Andika hedhi zako kwa miezi kadhaa — ni mara ngapi zinakuja na kwa nafasi gani. Andika pia mabadiliko ya ' +
        'ngozi, nywele na uzito. Rekodi hii ndiyo itakayoifanya ziara ya kwanza kwa mtaalamu iwe na maana.',
      selfCare:
        'Mlo wenye uwiano na mazoezi ya kawaida husaidia watu wengi kudhibiti dalili, lakini hiyo si tiba na si ' +
        'lawama kwa yeyote. Hakuna kitu ulichofanya kilichosababisha hali hii.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama hedhi zako hazitabiriki kwa miezi kadhaa, kama kuna mabadiliko unayoyaona, au kama ' +
        'unajaribu kupata ujauzito bila mafanikio. PCOS inatambulika kwa vipimo, na ikijulikana kuna njia za ' +
        'kuisimamia.',
      whenUrgent:
        'PCOS yenyewe si dharura. Lakini damu nyingi isiyokoma, au maumivu makali ya ghafla ya tumbo la chini, ' +
        'ni sababu ya kwenda hospitali mara moja.',
    },
  }),

  item({
    title: 'Endometriosis ni nini',
    content:
      'Endometriosis ni hali ambapo utando unaofanana na ule wa ndani ya mfuko wa uzazi hukua nje yake. ' +
      'Inaweza kusababisha maumivu makali, na inatambulika na mtaalamu — si kwa maelezo pekee.',
    sections: {
      whatMayBeHappening:
        'Utando huu hufuata mabadiliko ya homoni kila mwezi kama ule wa ndani, lakini hauna njia ya kutoka. ' +
        'Hilo linaweza kusababisha maumivu, hasa wakati wa hedhi. Ukali wa maumivu haumaanishi ukubwa wa hali, ' +
        'na watu wengine hawana dalili kabisa.',
      whatToMonitor:
        'Maumivu yanaanza lini kuhusiana na hedhi na yanadumu muda gani. Kama yanakuzuia kufanya kazi, kusoma au ' +
        'kulala. Kama kuna maumivu wakati wa kujamiiana, wakati wa kwenda haja, au maumivu ya nyonga nje ya hedhi.',
      selfCare:
        'Joto, kupumzika na dawa za maumivu za kawaida husaidia wengine kwa kiasi. Andika maumivu yako — watu wengi ' +
        'huambiwa maumivu makali ya hedhi ni ya kawaida, na rekodi ya miezi kadhaa ni njia bora ya kuonyesha ' +
        'kwamba yanavuka hapo.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama maumivu ya hedhi yanakuzuia kufanya shughuli za kawaida, kama yanazidi kuwa mabaya, ' +
        'au kama dawa za kawaida hazisaidii. Hii si kitu cha kuvumilia kimya, na kuchunguzwa ni haki yako.',
      whenUrgent:
        'Maumivu makali ya ghafla yasiyovumilika, homa pamoja na maumivu ya nyonga, au kuzimia — nenda hospitali mara moja.',
    },
  }),

  item({
    title: 'Uvimbe kwenye mfuko wa uzazi (fibroids)',
    content:
      'Fibroids ni uvimbe usio wa saratani unaokua kwenye au kando ya mfuko wa uzazi. Ni wa kawaida, na wengi ' +
      'hawaleti dalili yoyote.',
    sections: {
      whatMayBeHappening:
        'Fibroids hukua kutokana na mchanganyiko wa homoni na sababu nyingine. Ukubwa na mahali ulipo ndio ' +
        'huamua kama utaleta dalili. Zinapotokea, dalili za kawaida ni hedhi nzito, hedhi ndefu, shinikizo au ' +
        'maumivu ya tumbo la chini, na kwenda haja ndogo mara kwa mara.',
      whatToMonitor:
        'Kiasi cha damu na urefu wa hedhi. Hisia ya shinikizo au uzito tumboni. Mabadiliko katika kwenda haja. ' +
        'Kama unahisi uchovu usio wa kawaida, ambao unaweza kuhusiana na kupungua kwa damu.',
      selfCare:
        'Vyakula vyenye madini ya chuma vinaweza kusaidia kama hedhi ni nzito. Zaidi ya hapo, fibroids hazipungui ' +
        'kwa tiba za nyumbani, na kuahidiwa hivyo na yeyote ni sababu ya kuwa makini.',
      whenToSeekAdvice:
        'Ongea na mtaalamu kama hedhi zimekuwa nzito au ndefu kuliko ilivyokuwa, kama unahisi shinikizo tumboni, ' +
        'au kama unapanga ujauzito. Fibroids hutambuliwa kwa uchunguzi, na kuna njia kadhaa za kuzisimamia ' +
        'kulingana na dalili na mipango yako.',
      whenUrgent:
        'Damu nyingi isiyokoma, maumivu makali ya ghafla, au kizunguzungu na kuzimia — nenda hospitali sasa hivi.',
    },
  }),

  item({
    title: 'Kujua kama kuna maambukizi ya via vya uzazi',
    content:
      'Maambukizi mengi ya via vya uzazi hayana dalili kabisa. Hiyo ndiyo sababu kupima ndiyo njia pekee ya kujua, ' +
      'si kuangalia dalili.',
    sections: {
      whatMayBeHappening:
        'Maambukizi yanaweza kuletwa na bakteria, fangasi au virusi, na mengine huambukizwa kwa njia ya kujamiiana. ' +
        'Dalili zinapotokea zinaweza kufanana kati ya aina moja na nyingine, kwa hiyo hata mtaalamu hategemei ' +
        'maelezo pekee — hutegemea kipimo.',
      whatToMonitor:
        'Mabadiliko ya uchafu (rangi, harufu, kiasi). Muwasho au kuungua. Maumivu wakati wa kukojoa au kujamiiana. ' +
        'Vidonda au uvimbe. Maumivu ya tumbo la chini. Homa. Lakini kumbuka: kutokuwa na dalili hakumaanishi ' +
        'kutokuwa na maambukizi.',
      selfCare:
        'Usijitibu kwa dawa za kununua bila kipimo — dawa isiyofaa inaweza kuficha tatizo au kulifanya gumu zaidi ' +
        'kutibu. Kondomu hupunguza hatari ya maambukizi mengi yanayoambukizwa kwa njia ya kujamiiana.',
      whenToSeekAdvice:
        'Nenda kupima kama una dalili zozote hapo juu, kama mwenzi wako ana dalili au amegundulika na maambukizi, ' +
        'au kama unataka tu kujua hali yako. Kupima ni jambo la kawaida la kujitunza, si la kuona aibu, na ' +
        'maambukizi mengi hutibika vizuri yakijulikana.',
      whenUrgent:
        'Homa kali pamoja na maumivu ya tumbo la chini, maumivu makali ya nyonga, au uchafu wenye harufu mbaya ' +
        'baada ya kujifungua au upasuaji — nenda hospitali mara moja.',
    },
    sourceUrl: WHO,
  }),
];

const FACTS = [
  fact({
    title: 'Mawasiliano ya Afya Nyumbani',
    content:
      'Unaweza kuwasiliana na Afya Nyumbani kwa njia hizi:\n\n' +
      'Simu na WhatsApp: 0655 589 777\n' +
      'Namba ya pili: 0627 858 827\n' +
      'Barua pepe: afyanyumbanicare@gmail.com\n' +
      'Mahali: Dar es Salaam, Tanzania\n\n' +
      'Unaweza pia kuomba ziara moja kwa moja kupitia app hii, kwenye ukurasa wa "Omba ziara".',
  }),
  fact({
    title: 'Huduma ya Afya Nyumbani inavyofanya kazi',
    content:
      'Hatua za kawaida ni hizi:\n\n' +
      '1. Unaomba huduma kupitia app, simu au WhatsApp.\n' +
      '2. Timu inapitia mahitaji na hali ya mgonjwa.\n' +
      '3. Tathmini ya kitaalamu hufanyika ili kuamua mpango wa huduma unaofaa.\n' +
      '4. Muuguzi aliyehitimu huja nyumbani na vifaa vinavyohitajika.\n' +
      '5. Huduma hutolewa nyumbani kwako.\n' +
      '6. Ufuatiliaji hupangwa kulingana na mahitaji ya mgonjwa.\n\n' +
      'Huduma ya palliative care bado inaandaliwa. Kwa sasa wasiliana na timu kabla ya kuitegemea.',
  }),
];

const ROWS = [...ITEMS, ...FACTS];

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('knowledge_items', ROWS);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('knowledge_items', { source: SOURCE });
  },
};
