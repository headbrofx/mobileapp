'use strict';

const service = require('../services/nutrition.service');
const { success } = require('../utils/apiResponse');

async function getProfile(req, res, next) {
  try {
    const profile = await service.getProfile(req.familyMember.id);
    return success(res, { message: 'Nutrition profile', data: { profile } });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await service.updateProfile(req.familyMember.id, req.body);
    return success(res, { message: 'Nutrition profile updated', data: { profile } });
  } catch (err) {
    next(err);
  }
}

async function logMeal(req, res, next) {
  try {
    const meal = await service.logMeal(req.familyMember.id, req.body);
    return success(res, {
      statusCode: 201,
      message: 'Meal logged',
      data: { meal, caloriesAreApproximate: true, disclaimer: service.CALORIE_DISCLAIMER },
    });
  } catch (err) {
    next(err);
  }
}

async function listMeals(req, res, next) {
  try {
    const meals = await service.listMeals(req.familyMember.id, { date: req.query.date });
    return success(res, {
      message: 'Meals',
      data: { meals, caloriesAreApproximate: true, disclaimer: service.CALORIE_DISCLAIMER },
    });
  } catch (err) {
    next(err);
  }
}

async function deleteMeal(req, res, next) {
  try {
    await service.deleteMeal(req.familyMember.id, req.params.mealId);
    return success(res, { message: 'Meal deleted' });
  } catch (err) {
    next(err);
  }
}

async function logWater(req, res, next) {
  try {
    const entry = await service.logWater(req.familyMember.id, req.body);
    return success(res, { statusCode: 201, message: 'Water logged', data: { entry } });
  } catch (err) {
    next(err);
  }
}

async function listWater(req, res, next) {
  try {
    const entries = await service.listWater(req.familyMember.id, { date: req.query.date });
    return success(res, { message: 'Water log', data: { entries } });
  } catch (err) {
    next(err);
  }
}

async function deleteWater(req, res, next) {
  try {
    await service.deleteWater(req.familyMember.id, req.params.waterId);
    return success(res, { message: 'Water entry deleted' });
  } catch (err) {
    next(err);
  }
}

async function dailySummary(req, res, next) {
  try {
    const summary = await service.dailySummary(req.familyMember.id, req.query.date);
    return success(res, { message: 'Nutrition summary', data: summary });
  } catch (err) {
    next(err);
  }
}

// Reference data, not a person's data — so it hangs off /api/foods
// rather than a family member.
async function searchFoods(req, res, next) {
  try {
    const foods = await service.searchFoods(req.query.q);
    return success(res, {
      message: 'Food catalogue',
      data: { foods, caloriesAreApproximate: true, disclaimer: service.CALORIE_DISCLAIMER },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  logMeal,
  listMeals,
  deleteMeal,
  logWater,
  listWater,
  deleteWater,
  dailySummary,
  searchFoods,
};
