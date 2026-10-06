'use strict';

// Advice is free.
//
// The owner's rule: every consultation and advisory service costs the
// client nothing. Health Education was already set to zero by hand on
// production; this makes the rule part of the schema's history so a
// fresh database ends up the same, and adds the consultation service
// the catalogue never had.
//
// "Advisory" is decided by category, not by name, so a renamed service
// keeps its price and a new one filed under these categories is free
// from the start.
const FREE_CATEGORIES = ['Consultation', 'Education'];

const CONSULTATION = {
  name: 'Health Consultation',
  slug: 'health-consultation',
  category: 'Consultation',
  description: 'Ushauri wa afya kutoka kwa muuguzi, bila malipo.',
  durationMinutes: 30,
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    const [existing] = await sequelize.query('SELECT id FROM services WHERE slug = :slug', {
      replacements: { slug: CONSULTATION.slug },
    });
    if (existing.length === 0) {
      await sequelize.query(
        `INSERT INTO services (id, name, slug, category, description, base_price_tzs, duration_minutes, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :slug, :category, :description, 0, :duration, true, now(), now())`,
        {
          replacements: {
            name: CONSULTATION.name,
            slug: CONSULTATION.slug,
            category: CONSULTATION.category,
            description: CONSULTATION.description,
            duration: CONSULTATION.durationMinutes,
          },
        }
      );
    }

    await sequelize.query('UPDATE services SET base_price_tzs = 0, updated_at = now() WHERE category IN (:categories)', {
      replacements: { categories: FREE_CATEGORIES },
    });
  },

  async down(queryInterface) {
    // Prices are not put back: what they were before is not recorded
    // here, and guessing would be worse than leaving them free.
    await queryInterface.sequelize.query('DELETE FROM services WHERE slug = :slug', {
      replacements: { slug: CONSULTATION.slug },
    });
  },
};
