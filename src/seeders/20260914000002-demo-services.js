'use strict';

const { v4: uuidv4 } = require('uuid');

// Initial service catalog from the user's own Phase 5 spec. Prices are
// placeholders — Phase 14 (Payments & Billing) will make these editable
// by ops rather than hardcoded.
const services = [
  { name: 'Home Nursing', category: 'Nursing', basePriceTzs: 30000, durationMinutes: 60 },
  { name: 'Elderly Care', category: 'Care', basePriceTzs: 35000, durationMinutes: 120 },
  { name: 'Wound Care', category: 'Nursing', basePriceTzs: 25000, durationMinutes: 45 },
  { name: 'Physiotherapy', category: 'Rehabilitation', basePriceTzs: 40000, durationMinutes: 60 },
  { name: 'Postnatal Care', category: 'Maternal Health', basePriceTzs: 35000, durationMinutes: 90 },
  { name: 'Medication Administration', category: 'Nursing', basePriceTzs: 15000, durationMinutes: 30 },
  { name: 'Follow-up Visit', category: 'Nursing', basePriceTzs: 20000, durationMinutes: 30 },
  { name: 'Health Education', category: 'Education', basePriceTzs: 15000, durationMinutes: 45 },
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'services',
      services.map((s) => ({
        id: uuidv4(),
        name: s.name,
        slug: slugify(s.name),
        category: s.category,
        description: null,
        base_price_tzs: s.basePriceTzs,
        duration_minutes: s.durationMinutes,
        is_active: true,
        created_at: now,
        updated_at: now,
      }))
    );
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('services', { slug: services.map((s) => slugify(s.name)) });
  },
};
