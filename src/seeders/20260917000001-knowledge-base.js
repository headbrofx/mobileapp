'use strict';

const { v4: uuidv4 } = require('uuid');

// The starting knowledge base, so Afya AI can answer something.
//
// Everything here is a **business fact**, and every one of them is read
// out of this system rather than written from imagination: the service
// list and its prices come from the services table, the booking steps
// come from the booking state machine, and the privacy answer points at
// the policy the API serves.
//
// There is deliberately no HEALTH_EDUCATION here. Clinical content has
// to be written and signed off by somebody qualified — that is the
// whole point of the verifiedByProfessional gate, and seeding clinical
// text would walk straight around it. Afya AI will keep declining
// health questions until a professional puts answers in and signs them.
//
// COMPANY_INFO and SERVICE_INFO carry no sign-off gate because they are
// business information, not medical advice.

const SOURCE = 'seed:knowledge-base';

function money(amount) {
  return `TZS ${Number(amount).toLocaleString('en-US')}`;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Read the live catalogue rather than repeating it here. If a price
    // changes, re-running this seeder tells the truth again; a hardcoded
    // list would quietly start lying.
    const [services] = await queryInterface.sequelize.query(
      'SELECT name, category, base_price_tzs, duration_minutes FROM services WHERE is_active = true ORDER BY name'
    );

    if (services.length === 0) {
      throw new Error('No active services found — seed the service catalogue first.');
    }

    const serviceLines = services
      .map((service) => {
        const price = service.base_price_tzs ? `kuanzia ${money(service.base_price_tzs)}` : 'bei kwa mazungumzo';
        const duration = service.duration_minutes ? `, muda wa wastani dakika ${service.duration_minutes}` : '';
        return `• ${service.name} — ${price}${duration}`;
      })
      .join('\n');

    const cheapest = services
      .filter((service) => service.base_price_tzs)
      .sort((a, b) => a.base_price_tzs - b.base_price_tzs)[0];

    const ENTRIES = [
      {
        title: 'Huduma tunazotoa Afya Nyumbani',
        category: 'SERVICE_INFO',
        content:
          'Afya Nyumbani inatoa huduma zifuatazo nyumbani kwako, Dar es Salaam:\n\n' +
          `${serviceLines}\n\n` +
          'Bei hizi ni za kuanzia. Gharama halisi inaweza kutofautiana kulingana na mahitaji ya mgonjwa na umbali. ' +
          'Muuguzi anakuja nyumbani kwako — hulazimiki kwenda kliniki.',
      },
      {
        title: 'Bei za huduma za Afya Nyumbani ni ngapi',
        category: 'SERVICE_INFO',
        content:
          'Bei za kuanzia kwa kila huduma:\n\n' +
          `${serviceLines}\n\n` +
          (cheapest
            ? `Huduma ya bei nafuu zaidi ni ${cheapest.name}, kuanzia ${money(cheapest.base_price_tzs)}. `
            : '') +
          'Utapewa ankara baada ya ziara, na unaweza kuiona kwenye app chini ya "Ankara". ' +
          'Malipo yanapokelewa kwa fedha taslimu au kwa simu, na muuguzi au ofisi ndiyo inayoyaandika.',
      },
      {
        title: 'Jinsi ya kuomba muuguzi aje nyumbani',
        category: 'SERVICE_INFO',
        content:
          'Kuomba ziara kupitia app:\n\n' +
          '1. Fungua "Omba muuguzi".\n' +
          '2. Chagua huduma unayohitaji.\n' +
          '3. Chagua ni kwa ajili ya nani — wewe au mmoja wa unaowahudumia.\n' +
          '4. Chagua wakati unaokufaa.\n' +
          '5. Andika mahali ulipo, na maelezo yoyote muuguzi anapaswa kuyajua kabla hajafika.\n\n' +
          'Baada ya kutuma, ombi lako linakuwa "Imeombwa". Ofisi itampangia muuguzi, naye atakubali. ' +
          'Utaona hali ikibadilika kwenye ukurasa wa mwanzo: amepangiwa, yupo njiani, amefika, inaendelea, imekamilika. ' +
          'Muuguzi akiwa njiani, unaweza kuona amefikia wapi na muda wa kukadiria.',
      },
      {
        title: 'Naweza kubadilisha au kughairi ziara',
        category: 'SERVICE_INFO',
        content:
          'Ndiyo. Ziara ambayo bado haijaanza inaweza kuhairishwa au kughairiwa. ' +
          'Ukighairi, utaulizwa sababu — hiyo inatusaidia kuboresha huduma. ' +
          'Ukihairisha, muuguzi aliyekuwa amepangiwa anaondolewa na ofisi itampanga mwingine kwa wakati mpya.',
      },
      {
        title: 'Afya AI ni nini na haiwezi kufanya nini',
        category: 'COMPANY_INFO',
        content:
          'Afya AI ni msaidizi wa maswali ndani ya app hii.\n\n' +
          'Inachoweza: kujibu maswali kuhusu huduma zetu, bei, na jinsi ya kuomba ziara. ' +
          'Pia inatambua dalili za dharura na kukuambia uende kituo cha afya mara moja.\n\n' +
          'Isichoweza: Afya AI SI daktari. Haitoi uchunguzi wa ugonjwa, haiagizi dawa, ' +
          'na haikuambii dalili zako zinamaanisha nini. Maswali ya aina hiyo yanahitaji mtaalamu ' +
          'aliyekuona.\n\n' +
          'Ikiwa haina jibu lililothibitishwa, itasema wazi haijui badala ya kubahatisha. ' +
          'Hilo ni kwa makusudi.',
      },
      {
        title: 'Taarifa zangu za afya zinahifadhiwaje',
        category: 'COMPANY_INFO',
        content:
          'Taarifa zako zimehifadhiwa kwenye database iliyosimbwa, na mawasiliano yote kati ya simu yako ' +
          'na seva yetu yanapita kwa njia iliyosimbwa.\n\n' +
          'Anayeweza kuziona: wewe, muuguzi uliyepangiwa (kwa ziara yake kwako pekee), na wasimamizi ' +
          'wa Afya Nyumbani pale inapohitajika kuendesha huduma.\n\n' +
          'Hatuuzi taarifa zako na hatuzitumii kwa matangazo. Maswali unayouliza Afya AI hayatoki ' +
          'kwenye mifumo yetu kwenda kampuni nyingine yoyote.\n\n' +
          'Sera kamili ya faragha: https://afya-nyumbani-api.onrender.com/privacy',
      },
      {
        title: 'Afya Nyumbani ipo wapi na inahudumia wapi',
        category: 'COMPANY_INFO',
        content:
          'Afya Nyumbani Home Care Services Ltd ni kampuni ya huduma za afya nyumbani, ' +
          'yenye makao yake Dar es Salaam, Tanzania.\n\n' +
          'Tunaleta muuguzi nyumbani kwako badala ya wewe kwenda kliniki — hasa kwa wazee, ' +
          'wanaopona ugonjwa au upasuaji, na wanaohitaji uangalizi wa mara kwa mara.',
      },
    ];

    await queryInterface.bulkInsert(
      'knowledge_items',
      ENTRIES.map((entry) => ({
        id: uuidv4(),
        title: entry.title,
        content: entry.content,
        category: entry.category,
        language: 'SW',
        source: SOURCE,
        // Business facts, so no clinical sign-off applies. Health
        // material is a different matter and is not seeded at all.
        verified_by_professional: false,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('knowledge_items', { source: SOURCE });
  },
};
