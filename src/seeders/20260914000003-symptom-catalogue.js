'use strict';

const { v4: uuidv4 } = require('uuid');

// Starter catalogue — common presenting symptoms in home-care visits.
// Red-flag thresholds are deliberately conservative rules of thumb, not
// clinical guidance; Phase 8 (Afya AI safety layer) and real clinical
// review should refine these before this is relied on in production.
const items = [
  { name: 'Headache', category: 'NEUROLOGICAL', commonTriggers: ['stress', 'dehydration', 'lack of sleep'], relatedSymptoms: ['Dizziness', 'Nausea'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 3 },
  { name: 'Fever', category: 'GENERAL', commonTriggers: ['infection'], relatedSymptoms: ['Chills', 'Fatigue', 'Headache'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 3 },
  { name: 'Cough', category: 'RESPIRATORY', commonTriggers: ['cold', 'dust', 'smoke'], relatedSymptoms: ['Sore Throat', 'Shortness of Breath', 'Fever'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 14 },
  { name: 'Chest Pain', category: 'CARDIOVASCULAR', commonTriggers: ['exertion'], relatedSymptoms: ['Shortness of Breath'], alwaysRedFlag: true },
  { name: 'Shortness of Breath', category: 'RESPIRATORY', commonTriggers: ['exertion', 'asthma'], relatedSymptoms: ['Chest Pain', 'Cough'], alwaysRedFlag: true },
  { name: 'Abdominal Pain', category: 'DIGESTIVE', commonTriggers: ['food', 'infection'], relatedSymptoms: ['Nausea', 'Vomiting', 'Diarrhea'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 2 },
  { name: 'Nausea', category: 'DIGESTIVE', commonTriggers: ['food', 'pregnancy', 'medication'], relatedSymptoms: ['Vomiting', 'Abdominal Pain'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 3 },
  { name: 'Vomiting', category: 'DIGESTIVE', commonTriggers: ['food poisoning', 'infection'], relatedSymptoms: ['Nausea', 'Diarrhea', 'Abdominal Pain'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 2 },
  { name: 'Diarrhea', category: 'DIGESTIVE', commonTriggers: ['food', 'infection', 'water'], relatedSymptoms: ['Vomiting', 'Abdominal Pain', 'Fever'], redFlagSeverity: 'SEVERE', redFlagDurationDays: 3 },
  { name: 'Fatigue', category: 'GENERAL', commonTriggers: ['poor sleep', 'anemia', 'stress'], relatedSymptoms: ['Fever', 'Dizziness'], redFlagDurationDays: 14 },
  { name: 'Dizziness', category: 'NEUROLOGICAL', commonTriggers: ['dehydration', 'low blood pressure'], relatedSymptoms: ['Headache', 'Fatigue'], redFlagSeverity: 'SEVERE' },
  { name: 'Joint Pain', category: 'MUSCULOSKELETAL', commonTriggers: ['overuse', 'arthritis'], relatedSymptoms: ['Swelling', 'Back Pain'], redFlagDurationDays: 14 },
  { name: 'Back Pain', category: 'MUSCULOSKELETAL', commonTriggers: ['posture', 'lifting'], relatedSymptoms: ['Joint Pain'], redFlagDurationDays: 14 },
  { name: 'Skin Rash', category: 'SKIN', commonTriggers: ['allergy', 'infection', 'heat'], relatedSymptoms: ['Swelling', 'Fever'], redFlagSeverity: 'SEVERE' },
  { name: 'Swelling', category: 'GENERAL', commonTriggers: ['injury', 'infection'], relatedSymptoms: ['Joint Pain', 'Skin Rash'], redFlagSeverity: 'SEVERE' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'symptom_catalog_items',
      items.map((item) => ({
        id: uuidv4(),
        name: item.name,
        category: item.category,
        description: null,
        common_triggers: JSON.stringify(item.commonTriggers || []),
        related_symptoms: JSON.stringify(item.relatedSymptoms || []),
        always_red_flag: item.alwaysRedFlag || false,
        red_flag_severity: item.redFlagSeverity || null,
        red_flag_duration_days: item.redFlagDurationDays || null,
        created_at: now,
        updated_at: now,
      }))
    );
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('symptom_catalog_items', { name: items.map((i) => i.name) });
  },
};
