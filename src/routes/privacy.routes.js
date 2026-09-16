'use strict';

const { Router } = require('express');

const router = Router();

// The privacy policy, served from the API itself.
//
// Google Play requires a publicly reachable policy URL before a health
// app can be listed, and hosting it here costs nothing and cannot drift
// away from the service it describes.
//
// What it says was written from the schema and the access-control code,
// not from a template — every claim below is one this codebase actually
// keeps. Two things are deliberately left as placeholders for the
// owner: the contact address and the effective date. Publishing
// somebody's personal email on a public page is their decision, not
// mine, and a policy dated by a machine that has not been reviewed
// would be a lie about when it was agreed.
//
// This is a starting point written by an engineer who knows the system,
// not legal advice. Tanzania's Personal Data Protection Act 2022 and
// its regulations apply to this business, and somebody qualified should
// read this before it goes near a store listing.

const CONTACT_PLACEHOLDER = '[weka barua pepe ya kampuni hapa]';
const EFFECTIVE_PLACEHOLDER = '[weka tarehe baada ya kuipitia]';

const POLICY = `
<h1>Sera ya Faragha</h1>
<p class="lead">Afya Nyumbani Home Care Services Ltd, Dar es Salaam, Tanzania.</p>
<p class="meta">Inaanza kutumika: ${EFFECTIVE_PLACEHOLDER} &middot; Mawasiliano: ${CONTACT_PLACEHOLDER}</p>

<div class="notice">
  <strong>Rasimu.</strong> Hati hii imeandikwa kutokana na jinsi mfumo
  unavyofanya kazi kwa kweli, si kutoka kwenye template. Bado inapaswa
  kupitiwa na mtaalamu wa sheria kabla ya kutumika rasmi, kwa kuzingatia
  Sheria ya Ulinzi wa Taarifa Binafsi ya Tanzania ya mwaka 2022.
</div>

<h2>1. Taarifa tunazokusanya</h2>
<p><strong>Za akaunti:</strong> jina lako, namba ya simu, na barua pepe
ukiitoa. Nenosiri lako halihifadhiwi kamwe kama ulivyoliandika — tunahifadhi
alama yake ya siri (bcrypt) ambayo haiwezi kurudishwa kuwa nenosiri.</p>

<p><strong>Za afya:</strong> zinahifadhiwa kwa jina la mtu
anayehudumiwa, si kwa jina la mmiliki wa akaunti. Hizi ni pamoja na
vipimo vya afya, dalili unazoripoti, mzunguko wa hedhi, chakula na maji,
mazoezi, na dawa pamoja na ratiba zake.</p>

<p><strong>Za huduma:</strong> maombi ya ziara, anwani ya mahali
ulipoomba huduma, na hali ya ziara hiyo. Wakati muuguzi yuko njiani
kuja kwako, mahali <em>alipo yeye</em> hurekodiwa ili ujue anafika lini.
<strong>Hatufuatilii mahali ulipo wewe.</strong></p>

<p><strong>Za Afya AI:</strong> swali ulilouliza na jibu ulilopewa.</p>

<p><strong>Za kiufundi:</strong> anwani ya IP na aina ya kifaa
huhifadhiwa kwenye kumbukumbu za usalama pale hatua nyeti inapofanyika —
kuingia, kubadilisha ruhusa, au dharura kugunduliwa.</p>

<h2>2. Afya AI haitumi taarifa zako popote</h2>
<p>Afya AI haitumii model ya lugha ya kampuni nyingine. Inajibu kutoka
maandishi yaliyoandikwa na kuthibitishwa na wataalamu wetu wenyewe, na
onyo la dharura hutolewa kwa sheria zilizoandikwa ndani ya mfumo.</p>
<p>Maana yake: <strong>swali lako la afya halitoki kwenye mifumo yetu
kwenda kwa kampuni yoyote nyingine.</strong> Halitumwi kwa OpenAI, Google,
Anthropic wala mtu mwingine yeyote, na halitumiki kufundisha model ya
mtu yeyote.</p>

<h2>3. Nani anaweza kuona taarifa zako</h2>
<ul>
  <li><strong>Wewe</strong> — taarifa zako na za wale unaowahudumia.</li>
  <li><strong>Muuguzi uliyepangiwa</strong> — taarifa zinazohusu ziara
      yake kwako pekee, si historia ya familia nyingine.</li>
  <li><strong>Wasimamizi wa Afya Nyumbani</strong> — pale inapohitajika
      kuendesha huduma, na kila wanachokifanya kwenye taarifa nyeti
      huandikwa kwenye kumbukumbu.</li>
</ul>
<p>Hatuuzi taarifa zako. Hatuzitumii kwa matangazo. Hakuna kampuni ya
matangazo wala ya takwimu iliyounganishwa kwenye app hii.</p>

<h2>4. Zinahifadhiwa wapi</h2>
<p>Kwenye database iliyofichwa kwa usimbaji, inayohudumiwa na Neon
katika <strong>Frankfurt, Ujerumani</strong>, na seva ya app iko katika
kituo hicho hicho. Maana yake taarifa zako zinatoka Tanzania kwenda
Umoja wa Ulaya. Tumechagua Frankfurt kwa sababu ndiko karibu zaidi na
Dar es Salaam kati ya chaguo zilizopo, hivyo app inakuwa na kasi zaidi.</p>
<p>Mawasiliano yote kati ya simu yako na seva hufanyika kwa njia ya
HTTPS iliyosimbwa.</p>

<h2>5. Muda wa kuhifadhi</h2>
<p>Akaunti husitishwa, haifutwi. Kumbukumbu za ziara, matibabu na
malipo ni nyaraka ambazo biashara ya afya inawajibika kuzitunza, na
kuzifuta kungeondoa pia historia ya matibabu ya wateja wengine
iliyoambatana nazo.</p>
<p>Ukitaka taarifa zako zifutwe kabisa, wasiliana nasi kwa anwani iliyo
juu. Tutakueleza kwa uwazi kipi kinaweza kufutwa na kipi sheria
inatutaka tukitunze, na kwa nini.</p>

<h2>6. Haki zako</h2>
<ul>
  <li>Kuomba nakala ya taarifa zako.</li>
  <li>Kurekebisha kilichokosewa.</li>
  <li>Kuomba kufutwa, ndani ya mipaka ya kifungu cha 5.</li>
  <li>Kuondoa ridhaa na kuacha kutumia huduma wakati wowote.</li>
</ul>

<h2>7. Watoto</h2>
<p>Akaunti hufunguliwa na mtu mzima. Mzazi au mlezi anaweza kuweka
taarifa za mtoto wake kama mmoja wa wanaohudumiwa, na taarifa hizo
zinabaki chini ya akaunti yake na ulinzi ule ule.</p>

<h2>8. Onyo muhimu kuhusu Afya AI</h2>
<p>Afya AI si daktari na haitoi uchunguzi wa ugonjwa. Ikigundua dalili
za hatari, itakuambia uende kituo cha afya mara moja — na ushauri huo
ni wa kwenda kwa mtu, si wa kuendelea kuitumia app.</p>

<h2>9. Mabadiliko</h2>
<p>Sera hii ikibadilika, tutabadilisha tarehe iliyo juu na kuweka toleo
jipya hapa hapa.</p>
`;

const PAGE = `<!doctype html>
<html lang="sw">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sera ya Faragha &middot; Afya Nyumbani</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0 auto; padding: 24px 20px 64px; max-width: 46rem;
    font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #16211D; background: #F6F4F1;
  }
  h1 { font-size: 1.7rem; margin: 0 0 4px; color: #0D408F; }
  h2 { font-size: 1.1rem; margin: 32px 0 8px; color: #0D408F; }
  .lead { margin: 0; font-weight: 600; }
  .meta { color: #657A71; font-size: 0.9rem; margin-top: 4px; }
  .notice {
    background: #FFF3EA; border-left: 4px solid #FD6000;
    padding: 12px 16px; margin: 24px 0; border-radius: 6px; font-size: 0.95rem;
  }
  ul { padding-left: 1.25rem; }
  li { margin-bottom: 6px; }
  strong { font-weight: 650; }
  em { font-style: italic; }
</style>
</head>
<body>
${POLICY}
</body>
</html>`;

router.get('/privacy', (req, res) => {
  res.type('html').send(PAGE);
});

module.exports = router;
