'use strict';

const redFlags = require('../src/services/aiRedFlags.service');

// The emergencies Orbit's side of the app has to catch, and the ones
// it must not invent.
//
// These came from the owner's clinical brief. Four of them were not
// detected at all before: anaphylaxis, ectopic pregnancy, pre-eclampsia
// and the danger signs after delivery. A woman describing any of them
// would have been handed a general health answer.
//
// Two of the four cannot be a phrase match. Shoulder pain is usually a
// muscle and a headache is usually a headache; it is the pairing —
// shoulder with abdomen, headache with vision — that is the emergency.
// So the half that must stay quiet is tested as carefully as the pair
// that must fire. A warning that fires on everything is one nobody
// reads, and that failure is invisible until it matters.

const flags = (text) => redFlags.detect(text);

describe('Severe allergic reaction', () => {
  it.each([
    'ulimi umevimba na koo linabana',
    'mdomo umevimba ghafla baada ya kula',
    'my throat is closing and my face is swelling',
  ])('flags %s', (text) => {
    const result = flags(text);
    expect(result.isRedFlag).toBe(true);
    expect(result.categories).toContain('MZIO');
  });
});

describe('Ectopic pregnancy — the pair, not the half', () => {
  it('flags shoulder pain together with abdominal pain', () => {
    const result = flags('nina maumivu ya bega na tumbo linauma sana');
    expect(result.isRedFlag).toBe(true);
    expect(result.categories).toContain('MIMBA_NJE');
  });

  it('flags shoulder pain together with bleeding', () => {
    expect(flags('maumivu ya bega na natokwa damu').categories).toContain('MIMBA_NJE');
  });

  it('says nothing about a shoulder that is merely sore', () => {
    // The whole point. This is a muscle, and calling it an emergency
    // is how the emergency banner stops being believed.
    const result = flags('bega langu linauma baada ya kubeba mzigo mzito');
    expect(result.isRedFlag).toBe(false);
  });

  it('flags it when somebody names it outright', () => {
    expect(flags('daktari alisema ni mimba nje ya kizazi').categories).toContain('MIMBA_NJE');
  });
});

describe('Pre-eclampsia — the pair, not the half', () => {
  it('flags a headache with vision trouble', () => {
    const result = flags('nina maumivu makali ya kichwa na sioni vizuri');
    expect(result.isRedFlag).toBe(true);
    expect(result.categories).toContain('PRESHA_YA_MIMBA');
  });

  it('flags the English phrasing too', () => {
    expect(flags('severe headache and blurred vision').categories).toContain('PRESHA_YA_MIMBA');
  });

  it('leaves an ordinary headache alone', () => {
    expect(flags('nina maumivu ya kichwa kidogo leo').isRedFlag).toBe(false);
  });
});

describe('After delivery', () => {
  it.each([
    'nina homa baada ya kujifungua',
    'damu nyingi baada ya kujifungua',
    'nina uchafu wenye harufu mbaya',
    'fever after giving birth',
  ])('flags %s', (text) => {
    expect(flags(text).categories).toContain('BAADA_YA_KUJIFUNGUA');
  });
});

describe('The ordinary questions Orbit exists to answer', () => {
  // If these ever start flagging, the module has become a panic button
  // and stopped being useful for the thing people actually open it for.
  it.each([
    'hedhi yangu imechelewa siku tano',
    'kwa nini napata maumivu wakati wa hedhi',
    'ninaweza kupata mimba siku gani',
    'period inarudi lini baada ya kujifungua',
    'nina discharge ya kawaida',
    'ninanyonyesha naweza kupata mimba',
  ])('stays quiet on %s', (text) => {
    expect(flags(text).isRedFlag).toBe(false);
  });
});

describe('Nothing that already worked stopped working', () => {
  it.each([
    ['nashindwa kupumua', 'KUPUMUA'],
    ['maumivu ya kifua', 'KIFUA'],
    ['mtoto hachezi tumboni', 'UJAUZITO'],
    ['amemeza sumu', 'SUMU'],
  ])('still flags %s', (text, category) => {
    expect(flags(text).categories).toContain(category);
  });

  it('still gives self-harm its own wording rather than the general one', () => {
    const result = flags('nimechoka na maisha, nataka kufa');
    expect(result.isRedFlag).toBe(true);
    expect(result.guidance).not.toBe(redFlags.EMERGENCY_GUIDANCE);
    expect(result.guidance).toContain('Pole sana');
  });
});
