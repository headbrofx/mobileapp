'use strict';

// Emergency detection for free text, by rule and nothing else.
//
// This runs before retrieval, before any answer is assembled, and it has
// no dependencies — no database, no network, no model. That is the whole
// point: a warning to go to hospital must not be able to fail because
// something else was slow or unreachable.
//
// Swahili conjugates the verb, so the patterns here are stems rather
// than infinitives. "kumeza sumu" is how a dictionary writes it, but a
// parent types "mtoto amemeza sumu" — matching on "meza sumu" catches
// both, along with "nimemeza" and "alimeza".
//
// Matching is plain substring, deliberately. A false alarm sends someone
// to a nurse who tells them they are fine; a missed emergency does not
// get a second chance. When in doubt these rules flag.

const RULES = [
  {
    category: 'KUPUMUA',
    label: 'Shida ya kupumua / Difficulty breathing',
    patterns: [
      'shindwa kupumua', 'hawezi kupumua', 'shida ya kupumua', 'tabu ya kupumua',
      'kupumua kwa shida', 'anahema sana', 'pumzi fupi', 'kukosa pumzi',
      'cant breathe', 'can not breathe', 'cannot breathe', 'difficulty breathing',
      'trouble breathing', 'shortness of breath', 'struggling to breathe',
    ],
  },
  {
    category: 'KIFUA',
    label: 'Maumivu ya kifua / Chest pain',
    patterns: [
      'maumivu ya kifua', 'kifua kinauma', 'kifua chauma', 'kubanwa kifua',
      'kifua kinabana', 'chest pain', 'chest tightness', 'pain in my chest',
      'pressure in chest', 'pressure in my chest',
    ],
  },
  {
    category: 'FAHAMU',
    label: 'Kupoteza fahamu / Loss of consciousness',
    patterns: [
      'zimia', 'hana fahamu', 'poteza fahamu', 'hajitambui', 'hajielewi',
      'unconscious', 'passed out', 'fainted', 'unresponsive', 'blacked out',
    ],
  },
  {
    category: 'DEGEDEGE',
    label: 'Degedege / Seizure',
    patterns: [
      'degedege', 'kifafa', 'mshtuko wa mwili', 'anatetemeka mwili mzima',
      'seizure', 'convulsion', 'convulsing', 'fitting',
    ],
  },
  {
    category: 'DAMU',
    label: 'Kutokwa damu nyingi / Heavy bleeding',
    patterns: [
      'damu nyingi', 'tokwa damu', 'kuvuja damu', 'damu haikatiki', 'damu haisimami',
      'heavy bleeding', 'bleeding a lot', 'bleeding heavily', 'wont stop bleeding',
      'will not stop bleeding', 'losing a lot of blood',
    ],
  },
  {
    category: 'SUMU',
    label: 'Sumu au dawa kupita kiasi / Poisoning or overdose',
    patterns: [
      'meza sumu', 'nywa sumu', 'kula sumu', 'sumu',
      'meza dawa nyingi', 'nywa dawa nyingi', 'kumeza vidonge vingi',
      'swallowed poison', 'drank poison', 'poisoning', 'poisoned',
      'overdose', 'took too many pills', 'too many tablets',
    ],
  },
  {
    category: 'KIHARUSI',
    label: 'Dalili za kiharusi / Stroke signs',
    patterns: [
      'kiharusi', 'mdomo umepinda', 'uso umepinda', 'upande mmoja hausikii',
      'upande mmoja umepooza', 'ameshindwa kuongea ghafla',
      'stroke', 'face drooping', 'one side of the body', 'slurred speech',
      'sudden weakness on one side',
    ],
  },
  {
    category: 'UJAUZITO',
    label: 'Dharura ya ujauzito / Pregnancy emergency',
    patterns: [
      'mtoto hachezi tumboni', 'mtoto hasogei tumboni', 'damu wakati wa ujauzito',
      'uchungu kabla ya wakati', 'maji yamevunjika mapema',
      'baby not moving', 'bleeding while pregnant', 'bleeding in pregnancy',
      'water broke early', 'early labour', 'early labor',
    ],
  },
  {
    category: 'MTOTO',
    label: 'Dalili za hatari kwa mtoto mchanga / Infant danger signs',
    patterns: [
      'mtoto hanyonyi', 'mtoto hanywi', 'mtoto amelegea', 'mtoto hajakojoa',
      'mtoto hapumui vizuri', 'mtoto ana homa kali',
      'baby not feeding', 'baby is limp', 'baby not urinating', 'baby wont wake',
    ],
  },
  {
    category: 'KUJIDHURU',
    label: 'Kujidhuru / Self-harm',
    patterns: [
      'kujiua', 'nataka kufa', 'kujidhuru', 'nimechoka na maisha', 'sitaki kuishi',
      'kill myself', 'suicide', 'end my life', 'want to die', 'hurt myself',
      'harm myself',
    ],
    // Sending someone in this state to a queue and a general hospital
    // instruction is not enough on its own, so this category carries its
    // own wording.
    ownGuidance: [
      'Pole sana. Unachokisema ni kizito, na hupaswi kukibeba peke yako.',
      'Tafadhali mwambie mtu unayemwamini sasa hivi, au nenda kituo cha afya kilicho karibu.',
      'Afya Nyumbani itampigia muuguzi akuwasiliane nawe.',
      '',
      'We hear you, and you should not be alone with this right now.',
      'Please tell someone you trust, or go to your nearest health facility.',
      'Afya Nyumbani will have a nurse contact you.',
    ].join('\n'),
  },
  {
    category: 'MZIO',
    label: 'Mzio mkali / Severe allergic reaction',
    patterns: [
      'mzio mkali', 'alaji kali', 'mdomo umevimba', 'ulimi umevimba',
      'uso umevimba ghafla', 'koo linabana', 'koo limebana',
      'vipele mwili mzima', 'shindwa kumeza ghafla',
      'anaphylaxis', 'anaphylactic', 'allergic reaction',
      'throat closing', 'throat is closing', 'tongue swelling',
      'lips swelling', 'face swelling', 'hives all over',
    ],
  },
  {
    category: 'MIMBA_NJE',
    label: 'Dalili za mimba nje ya kizazi / Possible ectopic pregnancy',
    patterns: ['mimba nje ya kizazi', 'ectopic'],
    // Shoulder pain on its own is usually a muscle. Shoulder pain with
    // abdominal pain or bleeding is the classic ectopic presentation,
    // and the pair is what this has to catch. Flagging every sore
    // shoulder as an emergency would teach people to scroll past the
    // warning, which costs more than it saves.
    allOf: [
      ['bega', 'shoulder'],
      ['tumbo', 'damu', 'abdomen', 'abdominal', 'belly', 'bleeding'],
    ],
  },
  {
    category: 'PRESHA_YA_MIMBA',
    label: 'Dalili za presha ya ujauzito / Pre-eclampsia signs',
    patterns: [
      'kifafa cha mimba', 'presha ya mimba', 'kuona vimulimuli',
      'pre eclampsia', 'preeclampsia', 'eclampsia',
    ],
    // A headache is common; a headache with vision trouble is not.
    // Same reasoning as the rule above.
    allOf: [
      ['kichwa', 'headache'],
      ['kutoona', 'sioni vizuri', 'macho', 'ukungu', 'vision', 'blurred', 'flashing'],
    ],
  },
  {
    category: 'BAADA_YA_KUJIFUNGUA',
    label: 'Dalili za hatari baada ya kujifungua / Postnatal danger signs',
    patterns: [
      'homa baada ya kujifungua', 'damu nyingi baada ya kujifungua',
      'harufu mbaya baada ya kujifungua', 'uchafu wenye harufu mbaya',
      'kidonda cha upasuaji kimetoa usaha',
      'fever after delivery', 'fever after giving birth',
      'heavy bleeding after birth', 'heavy bleeding after delivery',
      'foul smelling discharge', 'bad smelling discharge',
    ],
  },
];

const EMERGENCY_GUIDANCE = [
  '⚠️ HII NI DHARURA. Nenda kituo cha afya kilicho karibu SASA, au piga simu kwa muuguzi wako.',
  'Usisubiri, na usitumie app hii kupata ushauri zaidi kwa sasa.',
  '',
  '⚠️ THIS IS AN EMERGENCY. Go to your nearest health facility NOW, or call your nurse.',
  'Do not wait, and do not rely on this app for further advice right now.',
].join('\n');

// Lowercase, strip punctuation, collapse whitespace. Keeps letters and
// digits only so "amemeza sumu!!" and "Amemeza  sumu" look the same.
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns every rule the text trips, not just the first. A message can
// describe more than one emergency at once, and a reviewer should see
// all of them.
function detect(text) {
  const haystack = normalize(text);
  const matched = [];

  for (const rule of RULES) {
    const hit = (rule.patterns ?? []).find((pattern) => haystack.includes(pattern));
    if (hit) {
      matched.push({ category: rule.category, label: rule.label, matched: hit });
      continue;
    }

    // A rule can also fire on a combination rather than a phrase: every
    // group in allOf has to contribute a word. Some things are only an
    // emergency together — shoulder pain with abdominal pain, a
    // headache with vision trouble — and flagging either half on its
    // own would fire on a large share of everything the app is ever
    // sent, which is how a warning stops being read.
    if (rule.allOf) {
      const parts = rule.allOf.map((group) => group.find((word) => haystack.includes(word)));
      if (parts.every(Boolean)) {
        matched.push({ category: rule.category, label: rule.label, matched: parts.join(' + ') });
      }
    }
  }

  if (matched.length === 0) {
    return { isRedFlag: false, categories: [], matches: [], guidance: null };
  }

  const selfHarm = RULES.find((r) => r.ownGuidance && matched.some((m) => m.category === r.category));

  return {
    isRedFlag: true,
    categories: matched.map((m) => m.category),
    matches: matched,
    guidance: selfHarm ? selfHarm.ownGuidance : EMERGENCY_GUIDANCE,
  };
}

module.exports = { detect, normalize, RULES, EMERGENCY_GUIDANCE };
