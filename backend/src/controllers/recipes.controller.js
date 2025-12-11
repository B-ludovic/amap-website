import recipeService from '../services/recipe.service.js';
import { prisma } from '../config/database.js';
import { HttpBadRequestError, httpStatusCodes } from '../utils/httpErrors.js';

export const searchRecipes = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Le paramètre "query" est requis',
      });
    }

    const recipes = await recipeService.searchRecipes(query);

    res.json({
      success: true,
      data: recipes,
    });
  } catch (error) {
    next(error);
  }
};

export const getRecipeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'L\'ID de la recette est requis',
      });
    }

    const recipe = await recipeService.getRecipeDetails(id);

    res.json({
      success: true,
      data: recipe,
    });
  } catch (error) {
    next(error);
  }
};

export const findRecipesByIngredients = async (req, res, next) => {
  try {
    const { ingredients, number } = req.query;

    if (!ingredients) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Le paramètre "ingredients" est requis',
      });
    }

    const ingredientsList = ingredients.split(',').map(i => i.trim());
    const recipes = await recipeService.findByIngredients(
      ingredientsList,
      number ? parseInt(number) : 6
    );

    res.json({
      success: true,
      data: recipes,
    });
  } catch (error) {
    next(error);
  }
};

export const getSuggestionsForWeeklyBasket = async (req, res, next) => {
  try {
    const { weeklyBasketId } = req.params;

    if (!weeklyBasketId) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'L\'ID du panier hebdomadaire est requis',
      });
    }

    // Récupérer le panier depuis la DB
    const weeklyBasket = await prisma.weeklyBasket.findUnique({
      where: { id: weeklyBasketId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!weeklyBasket) {
      return res.status(httpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Panier hebdomadaire introuvable',
      });
    }

    // Obtenir les suggestions de recettes
    const suggestions = await recipeService.getSuggestionsForWeeklyBasket(
      weeklyBasket.items
    );

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
};
