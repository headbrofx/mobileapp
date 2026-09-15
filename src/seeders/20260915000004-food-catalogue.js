'use strict';

const { v4: uuidv4 } = require('uuid');

// Common foods in Dar es Salaam, with rough calorie figures for the
// portions people actually serve — a plate of ugali, a cup of wali, one
// chapati — rather than per 100g, which nobody measures.
//
// These numbers are APPROXIMATIONS. They are close enough to show
// someone roughly how a day went, and they are not accurate enough for
// anything clinical. verifiedByProfessional stays false on every row
// until a nutritionist goes through them, and the API flags that on
// every response that carries a calorie figure.
const SOURCE = 'Approximate values for common household portions — pending review by a nutritionist';

const FOODS = [
  // --- Vyakula vya wanga ---
  ['Ugali wa mahindi', 'Maize ugali', 'STARCH', 'Kipande cha wastani / 1 medium piece', 220],
  ['Wali', 'Rice, cooked', 'STARCH', 'Kikombe 1 / 1 cup', 200],
  ['Pilau', 'Pilau rice', 'STARCH', 'Kikombe 1 / 1 cup', 300],
  ['Chapati', 'Chapati', 'STARCH', 'Chapati 1 / 1 piece', 250],
  ['Ndizi za kupika', 'Cooking bananas', 'STARCH', 'Ndizi 2 za wastani / 2 medium', 230],
  ['Viazi vitamu', 'Sweet potato', 'STARCH', 'Kiazi 1 cha wastani / 1 medium', 130],
  ['Muhogo', 'Cassava', 'STARCH', 'Kipande cha wastani / 1 medium piece', 240],
  ['Mkate', 'Bread', 'STARCH', 'Slaisi 2 / 2 slices', 150],
  ['Uji', 'Porridge', 'STARCH', 'Kikombe 1 / 1 cup', 120],

  // --- Kunde na maharage ---
  ['Maharage', 'Beans, cooked', 'LEGUME', 'Kikombe 1 / 1 cup', 230],
  ['Kunde', 'Cowpeas', 'LEGUME', 'Kikombe 1 / 1 cup', 200],
  ['Choroko', 'Green gram', 'LEGUME', 'Kikombe 1 / 1 cup', 210],
  ['Njegere', 'Green peas', 'LEGUME', 'Kikombe 1 / 1 cup', 130],

  // --- Nyama, samaki, mayai ---
  ['Kuku wa kukaanga', 'Fried chicken', 'PROTEIN', 'Kipande 1 / 1 piece', 250],
  ['Kuku wa kuchemsha', 'Boiled chicken', 'PROTEIN', 'Kipande 1 / 1 piece', 170],
  ['Nyama ya ng’ombe', 'Beef', 'PROTEIN', 'Vipande 3 vya wastani / 3 medium pieces', 250],
  ['Nyama ya mbuzi', 'Goat meat', 'PROTEIN', 'Vipande 3 vya wastani / 3 medium pieces', 230],
  ['Samaki wa kukaanga', 'Fried fish', 'PROTEIN', 'Samaki 1 wa wastani / 1 medium', 280],
  ['Samaki wa kuchemsha', 'Boiled fish', 'PROTEIN', 'Samaki 1 wa wastani / 1 medium', 180],
  ['Dagaa', 'Small dried fish', 'PROTEIN', 'Nusu kikombe / half a cup', 180],
  ['Yai', 'Egg', 'PROTEIN', 'Yai 1 / 1 egg', 80],

  // --- Mboga ---
  ['Mchicha', 'Amaranth greens', 'VEGETABLE', 'Kikombe 1 / 1 cup', 60],
  ['Sukuma wiki', 'Collard greens', 'VEGETABLE', 'Kikombe 1 / 1 cup', 70],
  ['Kabichi', 'Cabbage', 'VEGETABLE', 'Kikombe 1 / 1 cup', 50],
  ['Bamia', 'Okra', 'VEGETABLE', 'Kikombe 1 / 1 cup', 60],
  ['Nyanya', 'Tomato', 'VEGETABLE', 'Nyanya 1 / 1 tomato', 25],

  // --- Matunda ---
  ['Ndizi mbivu', 'Ripe banana', 'FRUIT', 'Ndizi 1 / 1 banana', 105],
  ['Embe', 'Mango', 'FRUIT', 'Embe 1 la wastani / 1 medium', 150],
  ['Papai', 'Pawpaw', 'FRUIT', 'Vipande 2 / 2 slices', 60],
  ['Chungwa', 'Orange', 'FRUIT', 'Chungwa 1 / 1 orange', 62],
  ['Nanasi', 'Pineapple', 'FRUIT', 'Vipande 2 / 2 slices', 50],

  // --- Maziwa ---
  ['Maziwa', 'Milk', 'DAIRY', 'Kikombe 1 / 1 cup', 150],
  ['Mtindi', 'Fermented milk', 'DAIRY', 'Kikombe 1 / 1 cup', 120],

  // --- Vinywaji ---
  ['Chai ya maziwa', 'Milk tea with sugar', 'DRINK', 'Kikombe 1 / 1 cup', 110],
  ['Soda', 'Soft drink', 'DRINK', 'Chupa 1 / 1 bottle (300ml)', 130],
  ['Juisi ya matunda', 'Fruit juice', 'DRINK', 'Glasi 1 / 1 glass', 110],
  ['Maji', 'Water', 'DRINK', 'Glasi 1 / 1 glass', 0],

  // --- Vitafunio ---
  ['Mandazi', 'Mandazi', 'SNACK', 'Mandazi 1 / 1 piece', 180],
  ['Sambusa', 'Samosa', 'SNACK', 'Sambusa 1 / 1 piece', 150],
  ['Karanga', 'Groundnuts', 'SNACK', 'Konzi 1 / 1 handful', 170],
  ['Kachori', 'Kachori', 'SNACK', 'Kachori 1 / 1 piece', 140],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'food_items',
      FOODS.map(([nameSw, nameEn, category, servingDescription, calories]) => ({
        id: uuidv4(),
        name_sw: nameSw,
        name_en: nameEn,
        category,
        serving_description: servingDescription,
        calories_per_serving: calories,
        source: SOURCE,
        verified_by_professional: false,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('food_items', { source: SOURCE });
  },
};
