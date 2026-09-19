import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN_BY_SW } from './i18n-en';
import { getItem, setItem } from './storage';

// Swahili and English.
//
// Swahili is the default and stays the default. Most clients of a home
// care service in Dar es Salaam read Swahili more comfortably than
// English, and an app that opens in English and offers Swahili as an
// afterthought has already told them who it was built for.
//
// A missing key falls back to Swahili rather than showing the key
// itself. A screen that has not been translated yet reads as a
// half-translated app, which is untidy; showing "home.greeting" reads
// as a broken one.

const STORAGE_KEY = 'afya.language';

const SW = {
  'common.all': 'Zote',
  'common.back': 'Rudi',
  'common.cancel': 'Ghairi',
  'common.continue': 'Endelea',
  'common.loading': 'Inapakia…',
  'common.save': 'Hifadhi',
  'common.signOut': 'Toka',
  'common.from': 'Kuanzia',
  'common.minutes': 'dakika',

  'nav.home': 'Mwanzo',
  'nav.book': 'Omba',
  'nav.visits': 'Ziara',
  'nav.profile': 'Wasifu',
  'nav.orbit': 'Orbit',
  'nav.services': 'Huduma zetu',
  'nav.bookVisit': 'Omba ziara',
  'nav.myVisits': 'Ziara zangu',
  'nav.ai': 'Afya AI',
  'nav.notifications': 'Taarifa',
  'nav.symptoms': 'Ripoti dalili',
  'nav.family': 'Familia yangu',
  'nav.medications': 'Dawa zangu',
  'nav.invoices': 'Ankara',
  'nav.settings': 'Mipangilio',
  'nav.new': 'MPYA',

  'home.greeting': 'Habari',
  'home.tagline': 'Huduma bora ya afya, ukiwa nyumbani kwako.',
  'home.brandTag': 'Huduma ya afya mlangoni kwako',
  'home.book': 'Omba ziara ya nyumbani',
  'home.ourServices': 'Huduma zetu',
  'home.featured': 'HUDUMA MAALUM',
  'home.nextVisit': 'Ziara inayofuata',
  'home.noVisit': 'Huna ziara inayokuja',
  'home.noVisitHint': 'Omba muuguzi kwa kitufe hapo juu.',
  'home.myVisits': 'Ziara zangu',
  'home.myVisitsHint': 'Ona ziara zote',
  'home.support': 'Msaada',
  'home.supportHint': 'Una swali? Uliza',
  'home.tip': 'Ushauri wa leo',

  'visits.title': 'Ziara zangu',
  'visits.subtitle': 'Huduma zako na safari ya matibabu',
  'visits.upcoming': 'Ziara ijayo nyumbani',
  'visits.patient': 'Anayepata huduma',
  'visits.place': 'Mahali pa ziara',
  'visits.noNurse': 'Muuguzi hajapangiwa bado',
  'visits.noNurseHint': 'Tutakujulisha atakapopangiwa',
  'visits.getSupport': 'Pata msaada',
  'visits.cancelVisit': 'Ghairi ziara',
  'visits.schedule': 'Ratiba ya ziara',
  'visits.otherUpcoming': 'Nyingine zinazokuja',
  'visits.past': 'Ziara zilizopita',
  'visits.noPast': 'Bado hakuna ziara iliyokamilika.',
  'visits.none': 'Huna ziara inayokuja',
  'visits.noneHint': 'Omba muuguzi aje nyumbani kwako.',

  'orbit.title': 'Orbit',
  'orbit.education': 'Elimu ya afya ya uzazi',
  'orbit.educationSoon': 'Makala za uzazi wa mpango na afya ya ngono zinakuja hivi karibuni.',
  'orbit.history': 'Kumbukumbu',
  'orbit.log': 'Andika hedhi',
  'orbit.nothingYet': 'Bado hujaandika chochote.',

  'settings.language': 'Lugha',
  'settings.theme': 'Rangi ya app',
};

const EN = {
  'common.all': 'All',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.signOut': 'Sign out',
  'common.from': 'From',
  'common.minutes': 'minutes',

  'nav.home': 'Home',
  'nav.book': 'Book',
  'nav.visits': 'Visits',
  'nav.profile': 'Profile',
  'nav.orbit': 'Orbit',
  'nav.services': 'Our services',
  'nav.bookVisit': 'Book a visit',
  'nav.myVisits': 'My visits',
  'nav.ai': 'Afya AI',
  'nav.notifications': 'Notifications',
  'nav.symptoms': 'Report symptoms',
  'nav.family': 'My family',
  'nav.medications': 'My medicines',
  'nav.invoices': 'Invoices',
  'nav.settings': 'Settings',
  'nav.new': 'NEW',

  'home.greeting': 'Hello',
  'home.tagline': 'Quality healthcare, in the comfort of your home.',
  'home.brandTag': 'Healthcare at your doorstep',
  'home.book': 'Book a home visit',
  'home.ourServices': 'Our services',
  'home.featured': 'FEATURED SERVICE',
  'home.nextVisit': 'Upcoming appointment',
  'home.noVisit': 'No upcoming visit',
  'home.noVisitHint': 'Book a nurse with the button above.',
  'home.myVisits': 'My bookings',
  'home.myVisitsHint': 'View all appointments',
  'home.support': 'Support',
  'home.supportHint': 'Need help? Ask',
  'home.tip': "Today's health tip",

  'visits.title': 'My care',
  'visits.subtitle': 'Your appointments and care journey',
  'visits.upcoming': 'Upcoming home visit',
  'visits.patient': 'Patient',
  'visits.place': 'Home visit location',
  'visits.noNurse': 'No nurse assigned yet',
  'visits.noNurseHint': "We'll tell you when one is assigned",
  'visits.getSupport': 'Get support',
  'visits.cancelVisit': 'Cancel visit',
  'visits.schedule': 'Visit timeline',
  'visits.otherUpcoming': 'Other upcoming visits',
  'visits.past': 'Previous visits',
  'visits.noPast': 'No completed visits yet.',
  'visits.none': 'No upcoming visit',
  'visits.noneHint': 'Book a nurse to come to your home.',

  'orbit.title': 'Orbit',
  'orbit.education': 'Reproductive health education',
  'orbit.educationSoon': 'Articles on family planning and sexual health are coming soon.',
  'orbit.history': 'History',
  'orbit.log': 'Log a period',
  'orbit.nothingYet': "You haven't logged anything yet.",

  'settings.language': 'Language',
  'settings.theme': 'App colour',
};

const DICTIONARIES = { sw: SW, en: EN };

export const LANGUAGES = [
  { code: 'sw', label: 'Kiswahili' },
  { code: 'en', label: 'English' },
];

const I18nContext = createContext(null);

// The chosen language, kept outside React as well as in it.
//
// tx() is exported as a plain function rather than only as a hook, so a
// helper component three levels down a screen can translate a label
// without every one of them taking a hook it does not otherwise need —
// and so a string can be translated outside a component altogether.
//
// That is only safe because of two facts about this app, both checked:
// every screen sits inside I18nProvider, so a language change re-renders
// all of them, and nothing here is wrapped in React.memo, so none of
// those re-renders is skipped. If either changes, a component reading
// this could hold stale words, and the hook below is the way back.
let current = 'sw';

export function tx(swahili) {
  return current === 'en' ? (EN_BY_SW[swahili] ?? swahili) : swahili;
}

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState('sw');
  const [ready, setReady] = useState(false);

  current = language;

  useEffect(() => {
    (async () => {
      try {
        const saved = await getItem(STORAGE_KEY);
        if (saved && DICTIONARIES[saved]) setLanguage(saved);
      } catch {
        // Storage can be unavailable; Swahili is the default anyway.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const choose = useCallback(async (code) => {
    if (!DICTIONARIES[code]) return;
    setLanguage(code);
    try {
      await setItem(STORAGE_KEY, code);
    } catch {
      // The choice still applies for this session.
    }
  }, []);

  const t = useCallback(
    (key, fallback) => DICTIONARIES[language][key] ?? SW[key] ?? fallback ?? key,
    [language]
  );

  // The same tx, handed out through the context as well, for the screens
  // that already take the hook. Bound to `language` so a component that
  // uses this one is re-rendered by React rather than by luck.
  const boundTx = useCallback(
    (swahili) => (language === 'en' ? (EN_BY_SW[swahili] ?? swahili) : swahili),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage: choose, t, tx: boundTx, ready }), [
    language,
    choose,
    t,
    boundTx,
    ready,
  ]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside an I18nProvider');
  return context;
}
