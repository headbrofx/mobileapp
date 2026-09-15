'use strict';

const { Op } = require('sequelize');
const { NutritionProfile, MealLog, WaterLog, FoodItem } = require('../models');
const AppError = require('../utils/appError');

// Nutrition tracking.
//
// Two things this file deliberately does NOT do.
//
// 1. It never calculates a calorie target. The arithmetic is easy —
//    weight, height, activity, done — but the number that comes out is
//    dietary advice, and it is wrong in exactly the cases where being
//    wrong matters: pregnancy, breastfeeding, childhood, diabetes,
//    recovery from illness, an eating disorder. dailyCalorieTarget is
//    stored only when a person or their nurse sets it deliberately.
//
// 2. It never passes judgement on what someone ate. The summary reports
//    what was logged and, if a target exists, what that target was. It
//    does not say "over", "under", "too much", or well done. An app
//    that scolds people about food does harm to some of the people
//    using it, and it is not this app's place.
//
// Calorie figures come from a catalogue of approximations for household
// portions. Every response carrying one says so.

const CALORIE_DISCLAIMER =
  'Kalori ni makadirio ya sehemu za kawaida za nyumbani, si vipimo vya maabara.';

function dayBounds(dateOnly) {
  const [year, month, day] = String(dateOnly).slice(0, 10).split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { start, end };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// --- Profile ---

async function getProfile(familyMemberId) {
  const [profile] = await NutritionProfile.findOrCreate({
    where: { familyMemberId },
    defaults: { familyMemberId },
  });
  return profile;
}

async function updateProfile(familyMemberId, payload) {
  const profile = await getProfile(familyMemberId);
  await profile.update(payload);
  return profile.reload();
}

// --- Food catalogue ---

async function searchFoods(query, { limit = 20 } = {}) {
  if (!query) {
    return FoodItem.findAll({ order: [['category', 'ASC'], ['nameSw', 'ASC']], limit: 200 });
  }

  const like = { [Op.iLike]: `%${query}%` };
  return FoodItem.findAll({
    where: { [Op.or]: [{ nameSw: like }, { nameEn: like }] },
    order: [['nameSw', 'ASC']],
    limit,
  });
}

// Resolve a logged item against the catalogue. A user may log something
// the catalogue has never heard of — ugali from their grandmother's
// recipe — and that is fine: the item is kept with whatever they told
// us, and its calories stay null rather than being invented.
async function resolveItems(items = []) {
  const resolved = [];

  for (const item of items) {
    const quantity = item.quantity == null ? 1 : item.quantity;
    const match = await FoodItem.findOne({
      where: {
        [Op.or]: [{ nameSw: { [Op.iLike]: item.name } }, { nameEn: { [Op.iLike]: item.name } }],
      },
    });

    if (match) {
      resolved.push({
        name: match.nameSw,
        nameEn: match.nameEn,
        quantity,
        servingDescription: match.servingDescription,
        calories: Math.round(match.caloriesPerServing * quantity),
        foodItemId: match.id,
        matched: true,
      });
    } else {
      resolved.push({
        name: item.name,
        quantity,
        // Whatever the user supplied, or nothing. Never a guess.
        calories: item.calories == null ? null : Math.round(item.calories),
        matched: false,
      });
    }
  }

  return resolved;
}

// --- Meals ---

async function logMeal(familyMemberId, { mealType, items = [], loggedAt }) {
  const resolved = await resolveItems(items);

  const known = resolved.filter((item) => item.calories != null);
  // Null rather than 0 when nothing could be counted — a total of zero
  // would read as "ate nothing", which is a different claim.
  const totalCalories = known.length
    ? known.reduce((sum, item) => sum + item.calories, 0)
    : null;

  const meal = await MealLog.create({
    familyMemberId,
    mealType,
    items: resolved,
    totalCalories,
    loggedAt: loggedAt || new Date(),
  });

  return meal;
}

async function listMeals(familyMemberId, { date = null } = {}) {
  const where = { familyMemberId };
  if (date) {
    const { start, end } = dayBounds(date);
    where.loggedAt = { [Op.between]: [start, end] };
  }
  return MealLog.findAll({ where, order: [['loggedAt', 'DESC']], limit: 200 });
}

async function deleteMeal(familyMemberId, mealId) {
  const meal = await MealLog.findOne({ where: { id: mealId, familyMemberId } });
  if (!meal) throw AppError.notFound('Meal not found');
  await meal.destroy();
}

// --- Water ---

async function logWater(familyMemberId, { amountMl, loggedAt }) {
  return WaterLog.create({ familyMemberId, amountMl, loggedAt: loggedAt || new Date() });
}

async function listWater(familyMemberId, { date = null } = {}) {
  const where = { familyMemberId };
  if (date) {
    const { start, end } = dayBounds(date);
    where.loggedAt = { [Op.between]: [start, end] };
  }
  return WaterLog.findAll({ where, order: [['loggedAt', 'DESC']], limit: 200 });
}

async function deleteWater(familyMemberId, waterId) {
  const entry = await WaterLog.findOne({ where: { id: waterId, familyMemberId } });
  if (!entry) throw AppError.notFound('Water entry not found');
  await entry.destroy();
}

// --- Daily summary ---

async function dailySummary(familyMemberId, date = null) {
  const day = date || today();
  const profile = await getProfile(familyMemberId);
  const meals = await listMeals(familyMemberId, { date: day });
  const water = await listWater(familyMemberId, { date: day });

  const countedMeals = meals.filter((meal) => meal.totalCalories != null);
  const caloriesLogged = countedMeals.reduce((sum, meal) => sum + meal.totalCalories, 0);
  const itemsWithoutCalories = meals
    .flatMap((meal) => meal.items || [])
    .filter((item) => item.calories == null).length;

  const waterMl = water.reduce((sum, entry) => sum + entry.amountMl, 0);

  return {
    date: day,
    meals: {
      logged: meals.length,
      byType: meals.reduce((acc, meal) => {
        acc[meal.mealType] = (acc[meal.mealType] || 0) + 1;
        return acc;
      }, {}),
      caloriesLogged: countedMeals.length ? caloriesLogged : null,
      // Says plainly how much of the day the number does not cover,
      // rather than presenting a partial total as a whole one.
      itemsWithoutCalories,
    },
    water: {
      totalMl: waterMl,
      entries: water.length,
      targetMl: profile.dailyWaterTargetMl,
    },
    // The target is reported, not compared against. No verdict is
    // returned here, on purpose — see the note at the top of this file.
    calorieTarget: profile.dailyCalorieTarget,
    goal: profile.goal,
    caloriesAreApproximate: true,
    disclaimer: CALORIE_DISCLAIMER,
  };
}

module.exports = {
  getProfile,
  updateProfile,
  searchFoods,
  logMeal,
  listMeals,
  deleteMeal,
  logWater,
  listWater,
  deleteWater,
  dailySummary,
  CALORIE_DISCLAIMER,
};
