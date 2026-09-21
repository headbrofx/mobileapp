// English, looked up by the Swahili it replaces.
//
// The tab bar and Home use keys, in i18n.js. Everything else uses this,
// and that is deliberate rather than lazy.
//
// A key per string was fine for the twenty or so words in the tab bar.
// For the other two hundred — every field label, every empty state,
// every button on a dozen more screens — it would mean inventing two
// hundred names, and a screen full of t('book.step2.hint') is a screen
// nobody can read or check against what it actually says.
//
// Looking up by the Swahili text means tx('Omba ziara') reads as the
// thing it draws, a missing entry falls through to Swahili rather than
// to a broken key, and Swahili stays the source rather than becoming the
// translation — it is the language most people using this app read most
// easily.
//
// It buys one more thing. A label sitting in a module-level array cannot
// call a translator when the module loads, because nobody has chosen a
// language yet. Keeping the Swahili in the array and calling tx() where
// it is drawn works, which is why the lists on Profile, Family and
// Symptoms still read as Swahili in the source.

export const EN_BY_SW = {
  // --- Ask Orbit: the structured answer ---
  'Kinachoweza kuwa kinatokea': 'What may be happening',
  'Cha kufuatilia': 'What to monitor',
  'Unachoweza kufanya': 'What you can do',
  'Lini kuona mtaalamu': 'When to see a professional',
  'Lini ni dharura': 'When it is urgent',
  Chanzo: 'Source',
  Ilipitiwa: 'Reviewed',
  'Jibu hili halilingani vizuri na swali lako. Kama halikujibu, muulize muuguzi.':
    'This answer is not a close match for your question. If it did not answer it, ask your nurse.',

  // --- Orbit ---
  Faragha: 'Private',
  Habari: 'Hello',
  'Siku ya mzunguko': 'Cycle day',
  'Bado hakuna mzunguko': 'No cycle recorded yet',
  Inakadiriwa: 'Estimated',
  Wastani: 'Average',
  Uthabiti: 'Consistency',
  Thabiti: 'Steady',
  Inatofautiana: 'Varies',
  Hedhi: 'Period',
  'Baada ya hedhi': 'After period',
  'Karibu na yai': 'Around ovulation',
  'Kabla ya hedhi': 'Before period',
  siku: 'days',
  Leo: 'Today',
  'Kutokana na mizunguko yako': 'Based on your last',
  'iliyopita. Ni makadirio, si uhakika.': 'cycles. An estimate, not a certainty.',
  'Orbit inahitaji angalau mizunguko miwili kabla ya kukadiria ujao.':
    'Orbit needs at least two cycles before it can estimate the next one.',
  'Orbit yako ndio kwanza inaanza': 'Your Orbit is just getting started',
  'Orbit yako ndio kwanza inaanza. Andika tarehe ya hedhi yako ya mwisho ili ianze kujifunza mzunguko wako.':
    'Your Orbit is just getting started. Record your last period so it can begin learning your cycle.',
  'Fanya uchunguzi mfupi wa kila siku ili Orbit ianze kuona mwenendo wako binafsi.':
    'Do the short daily check-in so Orbit can begin to see your own pattern.',
  'Anza kufuatilia': 'Start tracking',
  'Bado tunahitaji siku chache zaidi': 'We need a few more days yet',
  'Umeandika siku': 'You have recorded',
  'Orbit haitasema mwenendo wako kabla ya kuwa na uhakika.':
    'Orbit will not describe your pattern before it can be sure.',
  'Orbit leo': 'Orbit today',
  'Hakuna mabadiliko makubwa kwenye ulichoandika siku hizi za karibuni.':
    'No large change in what you have recorded recently.',
  'Kutokana na siku': 'From the',
  'ulizoandika.': 'days you recorded.',
  'zimekuwa chini kidogo': 'has been a little lower',
  'zimekuwa juu kidogo': 'has been a little higher',
  'kuliko siku zako za awali.': 'than on your earlier days.',
  Karibuni: 'Recent',
  awali: 'earlier',
  'Huu ni mwenendo wa kufuatilia, si uchunguzi wa ugonjwa.':
    'This is a pattern worth monitoring, not a diagnosis.',
  'Uchunguzi wa leo': "Today's check-in",
  'Umeandika leo': 'Recorded today',
  'Gusa kubadilisha ulichoandika.': 'Tap to change what you recorded.',
  'Sekunde 20 — hisia, nguvu, maumivu, usingizi.': '20 seconds — mood, energy, pain, sleep.',
  'wiki hii': 'this week',
  'Hali kwa ujumla': 'Wellness snapshot',
  'Ona zaidi': 'See more',
  'MONITORING inamaanisha bado hakuna siku za kutosha kusema, si kwamba kuna tatizo.':
    'MONITORING means there are not enough days to say yet, not that anything is wrong.',
  Jifunze: 'Learn',
  'Uliza Orbit': 'Ask Orbit',
  'Maktaba inakuja': 'The library is coming',
  'Makala za afya ya uzazi zinasubiri kupitiwa na mtaalamu kabla hazijachapishwa.':
    'Reproductive health articles are waiting for a professional to review them before publication.',
  'Ripoti ya mwezi': 'Monthly report',
  'Muhtasari wa kushiriki na mtaalamu': 'A summary to share with a professional',
  'Zungumza na mtaalamu': 'Talk to a professional',
  'Orbit si mbadala wa mtaalamu wa afya. Unaweza kuomba muuguzi wakati wowote.':
    'Orbit is not a substitute for a health professional. You can book a nurse at any time.',
  'Makadirio yote yanatokana na ulichoandika mwenyewe. Si uchunguzi wa kitabibu.':
    'Every estimate comes from what you recorded yourself. It is not a medical assessment.',
  'Kalenda ya mzunguko': 'Cycle calendar',
  'Mwenendo wa mwili wangu': 'My body patterns',
  'Andika hedhi': 'Log a period',

  // Orbit - check-in
  'Hakuna swali la lazima. Jibu unachojua, ruka kisichokuhusu leo.':
    'Nothing is required. Answer what you know, skip what does not apply today.',
  Nguvu: 'Energy',
  'Hamu ya kula': 'Appetite',
  Chini: 'Low',
  Juu: 'High',
  Mbaya: 'Poor',
  Mzuri: 'Good',
  Makali: 'Severe',
  'Hedhi leo': 'Period today',
  Hakuna: 'None',
  Matone: 'Spotting',
  Nyingi: 'Heavy',
  'Maumivu ya tumbo': 'Cramps',
  Kuvimbiwa: 'Bloating',
  'Maumivu ya kichwa': 'Headache',
  'Maumivu ya mgongo': 'Backache',
  Chunusi: 'Acne',
  Majimaji: 'Discharge',
  'Matiti kuuma': 'Tender breasts',
  Kichefuchefu: 'Nausea',
  Kizunguzungu: 'Dizziness',
  'Ulichoandika ni chako. Muuguzi anaona tu ukiamua kushiriki naye.':
    'What you record is yours. A nurse sees it only if you choose to share it.',

  // Orbit - patterns
  'ulizoandika katika siku': 'days recorded in the last',
  'zilizopita, na mizunguko': 'days, and cycles',
  'Wastani wako': 'Your averages',
  'Bado hujaandika': 'Not recorded yet',
  Siku: 'Days',
  'Karibu na hedhi': 'Around your period',
  'Bado hatujaweza kulinganisha': 'Not enough to compare yet',
  'Orbit inahitaji angalau mizunguko': 'Orbit needs at least',
  'iliyoandikwa, pamoja na siku za uchunguzi ndani na nje ya siku za kabla ya hedhi, kabla ya kulinganisha.':
    'recorded cycles, plus check-ins both inside and outside the days before a period, before it will compare.',
  'Siku 3 kabla': '3 days before',
  'siku nyingine': 'other days',
  na: 'and',
  Tofauti: 'Differs',
  Mtiririko: 'Flow',
  'Mtiririko ulioandika umekuwa mzito zaidi siku 1–2 za mwanzo.':
    'The flow you recorded has been heavier on the first 1–2 days.',
  'Mtiririko ulioandika haujatofautiana sana kati ya siku za mwanzo na zinazofuata.':
    'The flow you recorded has not differed much between the first days and the ones after.',
  'za mwanzo ulizoandika.': 'first days you recorded.',
  'Dalili zilizojirudia': 'Symptoms that recurred',
  'Bado hakuna dalili iliyoandikwa': 'No symptoms recorded yet',
  'Ukiweka alama kwenye dalili wakati wa uchunguzi, zitaonekana hapa.':
    'Tick symptoms during a check-in and they will appear here.',
  'Haya ni mahesabu ya ulichoandika mwenyewe, si uchunguzi wa kitabibu. Ukiona mabadiliko yanayokusumbua, zungumza na mtaalamu wa afya.':
    'These are counts of what you recorded yourself, not a medical assessment. If you notice changes that worry you, speak to a health professional.',

  // Orbit - report
  'RIPOTI YA ORBIT': 'ORBIT REPORT',
  Ulivyofuatilia: 'How you tracked',
  'siku zilizoandikwa mwezi huu': 'days recorded this month',
  'Siku chache zimeandikwa, kwa hiyo wastani hapa chini ni wa kuangalia kwa tahadhari.':
    'Few days were recorded, so treat the averages below with caution.',
  'Wastani wa mwezi': 'Monthly averages',
  'Hujaandika mwezi huu': 'Not recorded this month',
  Zilizoandikwa: 'Recorded',
  'Urefu wa wastani': 'Average length',
  'Hakuna ripoti ya mwezi huu bado': 'No report for this month yet',
  'Ripoti hujengwa kutokana na uchunguzi wa kila siku. Anza kufuatilia na itaonekana hapa.':
    'The report is built from daily check-ins. Start tracking and it will appear here.',
  'Shiriki na mtaalamu wa afya': 'Share with a health professional',
  'Omba muuguzi na mwoneshe muhtasari huu kwenye simu yako.':
    'Book a nurse and show them this summary on your phone.',
  'Ripoti hii ni muhtasari wa ulichoandika mwenyewe. Si uchunguzi wa kitabibu wala hairudishi haja ya kuonana na mtaalamu.':
    'This report summarises what you recorded yourself. It is not a medical assessment and does not replace seeing a professional.',
  Januari: 'January',
  Februari: 'February',
  Machi: 'March',
  Aprili: 'April',
  Mei: 'May',
  Juni: 'June',
  Julai: 'July',
  Agosti: 'August',
  Septemba: 'September',
  Oktoba: 'October',
  Novemba: 'November',
  Desemba: 'December',

  // --- Afya AI ---
  'Afya AI hujibu kutoka maandishi yaliyothibitishwa tu. Si mbadala wa daktari.':
    'Afya AI answers only from verified writing. It is not a substitute for a doctor.',
  'Anza mazungumzo mapya': 'Start a new chat',
  'Hakuna jibu lililothibitishwa kwa swali hili bado': 'No verified answer for this question yet',
  'Inatafuta jibu…': 'Looking for an answer…',
  'Limetoka kwenye maandishi yaliyosainiwa na mtaalamu':
    'From writing signed off by a professional',
  'Swali lako': 'Your question',
  'Tuma swali': 'Send question',
  'Uliza kuhusu afya yako au huduma zetu. Majibu yanatoka kwenye maandishi yaliyopitiwa na mtaalamu — hakuna kubahatisha.':
    'Ask about your health or our services. Answers come from writing reviewed by a professional — no guessing.',
  'Uliza swali lolote la afya…': 'Ask any health question…',
  'Bei ya huduma ya uuguzi nyumbani ni ngapi?': 'How much does home nursing cost?',
  'Mnatoa huduma gani kwa wazee?': 'What services do you offer for older people?',
  'Naweza kuomba muuguzi wa kubadilisha bandeji?': 'Can I book a nurse to change a dressing?',
  'Huduma ya baada ya kujifungua inahusisha nini?': 'What does postnatal care involve?',
  DHARURA: 'EMERGENCY',
  'Imegundua:': 'Detected:',

  // --- Booking ---
  'Huduma bora ya afya, karibu nawe': 'Quality healthcare, close to you',
  Salama: 'Safe',
  Haraka: 'Fast',
  'KARIBU!': 'WELCOME!',
  'Chagua huduma yako ya afya nyumbani': 'Choose your home healthcare service',
  'Daktari, muuguzi na huduma nyingine za afya — tunakuja nyumbani kwako.':
    'A doctor, a nurse and other health services — we come to your home.',
  'Huduma Salama': 'Safe care',
  'Wakati wako': 'Your time',
  'Nyumbani kwako': 'At your home',
  'Huduma Zilizopo': 'Available services',
  'Chagua huduma unayohitaji': 'Choose the service you need',
  Vichujio: 'Filters',
  Bei: 'Price',
  Muda: 'Duration',
  Kuanzia: 'From',
  Bure: 'Free',
  Jinsia: 'Gender',
  'Huamua kama Orbit inaonekana': 'Decides whether Orbit is shown',
  'Kabla hujaanza': 'Before you begin',
  'Orbit ni sehemu ya afya ya mwanamke. Tuambie jinsia yako ili tukuonyeshe sehemu inayokuhusu.':
    "Orbit is a women's health section. Tell us your gender so we can show you the right part of the app.",
  'Unaweza kuibadilisha wakati wowote kwenye wasifu wako.': 'You can change this any time in your profile.',
  'Orbit ni kwa afya ya mwanamke': "Orbit is for women's health",
  'Sehemu hii haipo kwenye akaunti yako. Kama jinsia iliyohifadhiwa si sahihi, ibadilishe kwenye wasifu wako.':
    'This section is not on your account. If the gender on file is wrong, change it in your profile.',
  'Rudi mwanzo': 'Back to home',
  Dakika: 'Minutes',
  'Inatuma…': 'Sending…',
  'Thibitisha ombi': 'Confirm request',
  Huduma: 'Service',
  Thibitisha: 'Confirm',
  'Andika mahali pa kufikika kwa urahisi': 'Somewhere easy to find',
  'Angalia kila kitu kabla ya kutuma': 'Check everything before you send',
  'Badilisha maelezo': 'Change the details',
  'Chagua huduma': 'Choose a service',
  'Chochote muuguzi anapaswa kujua kabla hajafika':
    'Anything the nurse should know before arriving',
  'Hali ya ombi': 'Request status',
  'Inapakia…': 'Loading…',
  'Kesho asubuhi': 'Tomorrow morning',
  'Kesho jioni': 'Tomorrow evening',
  'Keshokutwa asubuhi': 'Day after tomorrow, morning',
  'Keshokutwa jioni': 'Day after tomorrow, evening',
  Lini: 'When',
  Maelezo: 'Notes',
  'Maelezo (hiari)': 'Notes (optional)',
  Mahali: 'Place',
  Mgonjwa: 'Patient',
  'Muuguzi aje wapi': 'Where the nurse should come',
  'Muuguzi atapangiwa baada ya kutuma ombi. Utaona jina lake na hali ya ziara kwenye "Ziara".':
    'A nurse is assigned once you send the request. You will see their name and the status of the visit under "Visits".',
  'Na muda gani unakufaa': 'And what time suits you',
  'Nenda kwenye ziara zangu': 'Go to my visits',
  'Ni huduma gani unayohitaji?': 'Which service do you need?',
  'Ni kwa ajili ya nani': 'Who it is for',
  'Omba ziara ya nyumbani': 'Book a home visit',
  'Ombi limepokelewa': 'Request received',
  'Ongeza mtu mwingine wa familia': 'Add another family member',
  Rudi: 'Back',
  'Tarehe na muda': 'Date and time',
  'Tayari kutumwa': 'Ready to send',
  'Thibitisha ombi lako': 'Confirm your request',
  'Tutakupangia muuguzi na utaona hali ya ombi lako ikibadilika kwenye "Ziara".':
    'We will assign a nurse, and you will see your request change status under "Visits".',
  'mfano: Kariakoo, karibu na soko': 'e.g. Kariakoo, near the market',

  // --- Orbit ---
  'Andika hedhi': 'Log a period',
  Bado: 'Not yet',
  'Bado hujaandika chochote.': "You haven't logged anything yet.",
  'Chochote unachotaka kukumbuka': 'Anything you want to remember',
  'Elimu ya afya ya uzazi': 'Reproductive health education',
  Hisia: 'Mood',
  'Ilianza lini': 'When it started',
  'Iliisha lini (si lazima)': 'When it ended (optional)',
  Kiasi: 'Flow',
  Kumbukumbu: 'History',
  Leo: 'Today',
  'Maelezo (si lazima)': 'Notes (optional)',
  Makadirio: 'Estimate',
  'Makala za uzazi wa mpango na afya ya ngono zinakuja hivi karibuni.':
    'Articles on family planning and sexual health are coming soon.',
  Mwenendo: 'Pattern',
  'Mwezi ujao': 'Next month',
  'Mwezi uliopita': 'Previous month',
  'Mzunguko wako na elimu ya afya ya uzazi': 'Your cycle, and reproductive health education',
  'Orbit inahitaji angalau mizunguko miwili kabla ya kukadiria ujao.':
    'Orbit needs at least two cycles before it can estimate the next one.',
  Uliyoandika: 'Logged',
  Umeandika: 'Logged',
  'Wastani wa hedhi': 'Average period',
  'Wastani wa mzunguko': 'Average cycle',
  'hadi hedhi inayokadiriwa': 'until your estimated period',
  'kuliko makadirio': 'later than estimated',

  // --- Profile ---
  'Akaunti imethibitishwa': 'Account verified',
  'Andika unavyojisikia': 'Write down how you feel',
  Ankara: 'Invoices',
  'Dawa zangu': 'My medicines',
  'Dozi na ratiba': 'Doses and schedule',
  'Familia yangu': 'My family',
  'Huduma zangu': 'My care',
  'Kiswahili au English': 'Swahili or English',
  Mipangilio: 'Settings',
  'Omba ziara': 'Book a visit',
  'Rangi ya app na lugha': 'App colour and language',
  'Ripoti dalili': 'Report symptoms',
  Taarifa: 'Notifications',
  'Wale unaowahudumia': 'The people you care for',
  'Ziara zangu': 'My visits',
  'Zilizopita na zijazo': 'Past and upcoming',

  // --- Stack titles ---
  Soma: 'Read',

  // --- Visits ---
  Amepangiwa: 'Assigned',
  'Anayepata huduma': 'Patient',
  'Bado hakuna ziara iliyokamilika.': 'No completed visits yet.',
  'Ghairi ziara': 'Cancel visit',
  Hapana: 'No',
  'Huduma zako na safari ya matibabu': 'Your appointments and care journey',
  'Huna ziara inayokuja': 'No upcoming visit',
  Imekamilika: 'Completed',
  Imeombwa: 'Requested',
  Imethibitishwa: 'Confirmed',
  'Mahali pa ziara': 'Visit location',
  'Muuguzi hajapangiwa bado': 'No nurse assigned yet',
  'Ndiyo, ghairi': 'Yes, cancel',
  'Nyingine zinazokuja': 'Other upcoming visits',
  'Omba muuguzi aje nyumbani kwako.': 'Book a nurse to come to your home.',
  'Pata msaada': 'Get support',
  'Ratiba ya ziara': 'Visit timeline',
  'Tutakujulisha atakapopangiwa': 'We will tell you when one is assigned',
  'Ziara ijayo nyumbani': 'Upcoming home visit',
  'Ziara zilizopita': 'Previous visits',
  'Una uhakika unataka kughairi ziara hii?': 'Are you sure you want to cancel this visit?',

  // --- Article ---
  'Maelezo ya jumla. Kwa hali yako binafsi, ongea na muuguzi wako.':
    'General information. For your own situation, speak to your nurse.',

  // --- Family ---
  'Babu/Bibi': 'Grandparent',
  Ghairi: 'Cancel',
  Hifadhi: 'Save',
  Jina: 'Name',
  'Jina kamili': 'Full name',
  'Jinsia (hiari)': 'Gender (optional)',
  'Mfano: 1958-03-14': 'For example: 1958-03-14',
  Mke: 'Wife',
  Mtoto: 'Child',
  Mume: 'Husband',
  Mwenzi: 'Partner',
  Mwingine: 'Other',
  Mzazi: 'Parent',
  Ndugu: 'Sibling',
  Nyingine: 'Other',
  'Ongeza mtu': 'Add a person',
  'Ongeza mtu wa familia': 'Add a family member',
  'Tarehe ya kuzaliwa (hiari)': 'Date of birth (optional)',
  'Uhusiano wako naye': 'Your relationship to them',
  'Huna mtu wa familia aliyeandikwa.': 'No family members added yet.',
  Mwanamke: 'Female',
  Mwanaume: 'Male',

  // --- Invoices ---
  'Huna ankara yoyote.': 'You have no invoices.',
  Rasimu: 'Draft',
  Inadaiwa: 'Due',
  'Imelipwa kiasi': 'Part paid',
  Imelipwa: 'Paid',
  Imeghairiwa: 'Cancelled',
  'Ilipwe ifikapo': 'Due by',

  // --- Medicines ---
  'Dawa zako': 'Your medicines',
  'Hakuna dawa iliyoandikwa. Muuguzi wako ndiye anayeziandika hapa.':
    'No medicines recorded. Your nurse is the one who adds them here.',
  'Hakuna dozi inayokuja katika masaa 48 yajayo.': 'No doses due in the next 48 hours.',
  Nimekunywa: 'Taken',
  Nimeruka: 'Skipped',
  'Wiki iliyopita': 'Past week',
  Zinazofuata: 'Coming up',

  // --- Notifications ---
  'Hakuna taarifa bado.': 'Nothing yet.',
  'Soma zote': 'Mark all read',

  // --- Services ---
  'Hujaona unayoitaka?': 'Cannot see what you need?',
  'Uliza Afya AI': 'Ask Afya AI',
  'Uliza Afya AI, au wasiliana nasi. Baadhi ya huduma zinaweza kupangwa kwa maombi maalum.':
    'Ask Afya AI, or get in touch. Some services can be arranged on request.',

  // --- Settings ---
  Kuhusu: 'About',
  'Rangi ya app': 'App colour',
  'Sera ya faragha': 'Privacy policy',
  'Taarifa zako zinatumikaje': 'How your information is used',
  'Ukubwa wa maandishi': 'Text size',
  Madogo: 'Small',
  'Ya kawaida': 'Normal',
  Makubwa: 'Large',
  Kijani: 'Green',
  Chungwa: 'Orange',
  Buluu: 'Blue',
  'Inatumika sasa': 'In use now',
  'Gusa kuichagua': 'Tap to choose it',
  'Imehifadhiwa — fungua app upya ionekane': 'Saved — reopen the app to see it',
  'Ukichagua rangi, ukurasa unajipakia upya mara moja.':
    'When you pick a colour, the page reloads itself straight away.',
  'Rangi mpya inaonekana ukifungua app upya.':
    'The new colour appears the next time you open the app.',

  // --- Symptoms ---
  Dalili: 'Symptoms',
  'Bado hujaandika dalili yoyote.': 'You have not reported any symptoms yet.',
  'Chochote kingine cha kuongeza': 'Anything else to add',
  'Hakuna ishara ya hatari iliyogunduliwa kwa ulichoandika. Dalili ikizidi au ikibadilika, iandike tena.':
    'No warning sign was found in what you wrote. If the symptom gets worse or changes, report it again.',
  'Hii ni ishara ya kuchunguzwa na mtu, si uchunguzi wa ugonjwa.':
    'This is a sign for a person to look at, not a diagnosis.',
  Imeandikwa: 'Recorded',
  'Imechukua muda gani (hiari)': 'How long it has lasted (optional)',
  Kali: 'Severe',
  Kidogo: 'Mild',
  Masaa: 'Hours',
  Siku: 'Days',
  Wiki: 'Weeks',
  'ONA MTAALAMU': 'SEE A PROFESSIONAL',
  'Tuma dalili': 'Send symptom',
  Ukali: 'Severity',
  Wastani: 'Moderate',
  Zilizopita: 'Past reports',
  'mfano: 3': 'e.g. 3',
  'mfano: Headache': 'e.g. Headache',

  // --- Sign in and sign up ---
  'Andika namba ya simu au barua pepe uliyotumia kufungua akaunti.':
    'Enter the phone number or email you opened the account with.',
  'Namba ya simu au barua pepe': 'Phone number or email',
  'Rudi kuingia': 'Back to sign in',
  'Tuma ombi': 'Send request',
  'Tumelipokea ombi lako. Kwa sasa msimbo wa kubadilisha nenosiri haupo kwenye ujumbe — piga simu ofisini ili wakupe, kisha ubadilishe nenosiri lako.':
    'We have your request. For now the reset code does not arrive by message — call the office to get it, then change your password.',
  'Umesahau nenosiri?': 'Forgotten your password?',
  'Huna akaunti?': 'No account yet?',
  Ingia: 'Sign in',
  'Ingia kwenye akaunti yako ili uendelee': 'Sign in to your account to carry on',
  Jisajili: 'Sign up',
  'Karibu tena': 'Welcome back',
  'Maliza kujisajili': 'Finish signing up',
  'Namba ya simu': 'Phone number',
  Nenosiri: 'Password',
  'Nenosiri lako': 'Your password',
  Nikumbuke: 'Remember me',
  'Tunahitaji namba yako ya simu ili muuguzi ajue pa kukufuata.':
    'We need your phone number so the nurse knows where to find you.',
  'Aina ya damu': 'Blood group',
  'Akaunti yako iko tayari. Sasa unaweza kuomba muuguzi aje nyumbani kwako.':
    'Your account is ready. You can now book a nurse to come to your home.',
  'Andika jina lako': 'Enter your name',
  'Andika tena': 'Enter it again',
  'Anwani ya nyumbani': 'Home address',
  Anza: 'Start',
  'Barua pepe (si lazima)': 'Email (optional)',
  Endelea: 'Continue',
  'Fungua akaunti': 'Create an account',
  'Hapa ndipo muuguzi atakapokuja': 'This is where the nurse will come',
  'Haya ni yako peke yako. Muuguzi anayekuja kwako ndiye pekee atayaona.':
    'This is yours alone. Only the nurse who comes to you will see it.',
  'Herufi 8 au zaidi': '8 characters or more',
  'Jina lake': 'Their name',
  'Jina lako kamili': 'Your full name',
  'Jiunge na Afya Nyumbani upate huduma ya afya mlangoni kwako.':
    'Join Afya Nyumbani for healthcare at your doorstep.',
  'Magonjwa uliyonayo': 'Conditions you have',
  Mji: 'City',
  'Mtaa, nyumba namba': 'Street, house number',
  'Mtu wa dharura': 'Emergency contact',
  'Ruka kwa sasa': 'Skip for now',
  'Sera ya Faragha': 'Privacy Policy',
  'Simu ya mtu wa dharura': 'Emergency contact phone',
  'Tenganisha kwa koma': 'Separate with commas',
  'Thibitisha nenosiri': 'Confirm password',
  'Tutaitumia kuwasiliana nawe': 'We will use it to contact you',
  'Una akaunti tayari?': 'Already have an account?',
  'Vitu unavyoathiriwa navyo': 'Things you react to',
  'jina@mfano.com': 'name@example.com',
  'k.m. kisukari, shinikizo la damu': 'e.g. diabetes, high blood pressure',
  'k.m. penicillin': 'e.g. penicillin',

  // --- Shared furniture ---
  'Au endelea na': 'Or continue with',
  'Endelea na Google': 'Continue with Google',
  'Huduma bora ya afya, ndani ya nyumba yako.':
    'Quality healthcare, in the comfort of your home.',
  'Rudi nyuma': 'Go back',
  'Funga menyu': 'Close menu',
  'Funga menyu kwa kugusa pembeni': 'Close the menu by tapping beside it',
  'Fungua menyu': 'Open menu',
  Karibu: 'Welcome',
};
