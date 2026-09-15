'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('food_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      // Both languages, because people log food in whichever comes to
      // mind. A catalogue that only knows "rice" is no use to someone
      // typing "wali".
      nameSw: { type: Sequelize.STRING, allowNull: false, field: 'name_sw' },
      nameEn: { type: Sequelize.STRING, allowNull: true, field: 'name_en' },
      category: {
        type: Sequelize.ENUM(
          'STARCH',
          'LEGUME',
          'PROTEIN',
          'VEGETABLE',
          'FRUIT',
          'DAIRY',
          'DRINK',
          'SNACK',
          'OTHER'
        ),
        allowNull: false,
        defaultValue: 'OTHER',
      },
      // Described in household terms rather than grams, because nobody
      // in Dar weighs their ugali.
      servingDescription: { type: Sequelize.STRING, allowNull: false, field: 'serving_description' },
      caloriesPerServing: { type: Sequelize.INTEGER, allowNull: false, field: 'calories_per_serving' },
      // Where the number came from, and whether anyone qualified has
      // checked it. The seeded values are approximations for common
      // portions, not laboratory figures, and the API says so.
      source: { type: Sequelize.STRING, allowNull: true },
      verifiedByProfessional: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'verified_by_professional',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('food_items', ['name_sw']);
    await queryInterface.addIndex('food_items', ['category']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('food_items');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_food_items_category";');
  },
};
