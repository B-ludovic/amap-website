import express from 'express';
import {
  searchRecipes,
  getRecipeById,
  findRecipesByIngredients,
  getSuggestionsForWeeklyBasket,
} from '../controllers/recipes.controller.js';

const router = express.Router();

// Routes publiques - recherche de recettes
router.get('/search', searchRecipes);
router.get('/ingredients', findRecipesByIngredients);
router.get('/suggestions/weekly-basket/:weeklyBasketId', getSuggestionsForWeeklyBasket);
router.get('/:id', getRecipeById);

export default router;
