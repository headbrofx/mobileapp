'use strict';

const seeder = require('../src/seeders/20260921000002-orbit-knowledge-expanded');

// The house rules from the owner's clinical brief, enforced against the
// text itself.
//
// Content is the one part of this system with no type checker and no
// compiler. A sentence that quietly turns "this can be caused by" into
// "you have" passes every other test in the suite and ships. So the
// rules that matter get asserted here, on the strings, where a future
// edit has to trip over them.
//
// These are blunt instruments — substring checks against Swahili and
// English phrasings. They cannot judge clinical accuracy; only a nurse
// can, and the review gate is what makes them read it. What these can
// do is catch the four failure modes the brief names by name.

function rowsOf(seed) {
  let captured = [];
  seed.up({ bulkInsert: (_table, rows) => { captured = rows; } });
  return captured;
}

const rows = rowsOf(seeder);
const clinical = rows.filter((r) => r.category === 'HEALTH_EDUCATION');
const sectionsOf = (row) => JSON.parse(row.sections);
const allText = (row) => Object.values(sectionsOf(row)).join(' ') + ' ' + row.content;

describe('The review gate', () => {
  it('seeds every clinical entry unverified, so none of it can be served yet', () => {
    expect(clinical.length).toBeGreaterThan(0);
    for (const row of clinical) {
      expect(row.verified_by_professional).toBe(false);
      expect(row.verified_by).toBeNull();
      expect(row.verified_at).toBeNull();
    }
  });

  it('leaves business facts ungated, because no clinician signs off an address', () => {
    const business = rows.filter((r) => r.category === 'COMPANY_INFO');
    expect(business.length).toBeGreaterThan(0);
    // The gate lives in the search query (category <> HEALTH_EDUCATION
    // OR verified). These rows rely on that, so they must not be
    // clinical by category.
    for (const row of business) expect(row.category).toBe('COMPANY_INFO');
  });
});

describe('Shape', () => {
  it('gives every clinical entry all five sections, with something in each', () => {
    const required = [
      'whatMayBeHappening',
      'whatToMonitor',
      'selfCare',
      'whenToSeekAdvice',
      'whenUrgent',
    ];
    for (const row of clinical) {
      const sections = sectionsOf(row);
      for (const key of required) {
        expect(typeof sections[key]).toBe('string');
        expect(sections[key].trim().length).toBeGreaterThan(40);
      }
    }
  });

  it('ends every entry by naming the way out of the app', () => {
    // whenUrgent is the one section that is not an explanation. If it
    // does not send the reader somewhere, it has failed at its only job.
    for (const row of clinical) {
      const urgent = sectionsOf(row).whenUrgent.toLowerCase();
      const sendsThemOut =
        urgent.includes('hospitali') ||
        urgent.includes('dharura') ||
        urgent.includes('kituo cha afya');
      expect(sendsThemOut).toBe(true);
    }
  });
});

describe('What the brief forbids', () => {
  it('never tells somebody what they have', () => {
    // "una endometriosis", "una PCOS", "una maambukizi" — the brief is
    // explicit that a condition is never stated as a conclusion.
    const diagnosis = [
      'una endometriosis',
      'una pcos',
      'una fibroids',
      'una maambukizi ya',
      'you have endometriosis',
      'you have pcos',
    ];
    for (const row of clinical) {
      const text = allText(row).toLowerCase();
      for (const phrase of diagnosis) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  it('never rules a pregnancy out', () => {
    // "huna mimba" is named in the brief as a thing never to say.
    for (const row of clinical) {
      const text = allText(row).toLowerCase();
      expect(text).not.toContain('huna mimba');
      expect(text).not.toContain('huna ujauzito');
    }
  });

  it('never promises safe days', () => {
    for (const row of clinical) {
      const text = allText(row).toLowerCase();
      expect(text).not.toContain('siku salama');
      expect(text).not.toContain('safe days');
    }
  });

  it('does not guarantee or cure anything', () => {
    for (const row of clinical) {
      const text = allText(row).toLowerCase();
      expect(text).not.toContain('itakutibu');
      expect(text).not.toContain('tiba ya uhakika');
      expect(text).not.toContain('guaranteed');
      expect(text).not.toContain('100%');
    }
  });
});

describe('The two entries with a specific thing to get right', () => {
  it('separates emergency contraception from abortion, as the brief requires', () => {
    const row = clinical.find((r) => r.title.includes('dharura'));
    expect(row).toBeTruthy();
    expect(allText(row)).toContain('Si dawa ya kutoa mimba');
  });

  it('says plainly that breastfeeding is not contraception', () => {
    const row = clinical.find((r) => r.title.includes('Kunyonyesha'));
    expect(row).toBeTruthy();
    // The question people ask expects "no". The honest answer is yes.
    expect(allText(row).toLowerCase()).toContain('inawezekana kupata ujauzito');
  });
});

describe('The business facts', () => {
  it('carries the public business address, never the developer one', () => {
    const text = rows.map((r) => r.content).join(' ');
    expect(text).toContain('afyanyumbanicare@gmail.com');
    expect(text).not.toContain('joeroberty01');
  });

  it('does not present palliative care as something available today', () => {
    const row = rows.find((r) => r.title.includes('inavyofanya kazi'));
    expect(row.content.toLowerCase()).toContain('bado inaandaliwa');
  });
});
