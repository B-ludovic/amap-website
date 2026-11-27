import recipeService from '../services/recipe.service.js';
import { prisma } from '../config/database.js';
import { HttpBadRequestError, httpStatusCodes } from '../utils/httpErrors.js';

const MAX_QUERY_LENGTH = 60;
const MAX_INGREDIENTS = 5;
const MAX_RESULTS = 12;

// req.query peut aussi livrer un tableau (?query=a&query=b) ou un objet.
const isSearchTerm = (value) => typeof value === 'string' && value.length <= MAX_QUERY_LENGTH;

export const searchRecipes = async (req, res, next) => {
  try {
    const { query, queryEn } = req.query;

    if (!query) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Le paramètre "query" est requis',
      });
    }

    if (!isSearchTerm(query) || (queryEn !== undefined && !isSearchTerm(queryEn))) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `La recherche est limitée à ${MAX_QUERY_LENGTH} caractères`,
      });
    }

    const recipes = await recipeService.searchRecipes(query, 12, queryEn || null);

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

    // TheMealDB n'attribue que des identifiants numériques. Sans zéro de tête,
    // une fiche n'a qu'une clé de cache : « 052772 » ne la retraduit pas.
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Identifiant de recette invalide',
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
    const { ingredients, number, queryEn } = req.query;

    if (!ingredients) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Le paramètre "ingredients" est requis',
      });
    }

    if (!isSearchTerm(ingredients) || (queryEn !== undefined && !isSearchTerm(queryEn))) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `La recherche est limitée à ${MAX_QUERY_LENGTH} caractères`,
      });
    }

    // Chaque ingrédient coûte une traduction, chaque recette une fiche et une traduction.
    const ingredientsList = ingredients.split(',').map(i => i.trim()).filter(Boolean);
    if (ingredientsList.length === 0 || ingredientsList.length > MAX_INGREDIENTS) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Indiquez entre 1 et ${MAX_INGREDIENTS} ingrédients`,
      });
    }

    const count = number === undefined ? 6 : Number(number);
    if (!Number.isInteger(count) || count < 1 || count > MAX_RESULTS) {
      return res.status(httpStatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Le nombre de recettes demandé va de 1 à ${MAX_RESULTS}`,
      });
    }

    const recipes = await recipeService.findByIngredients(ingredientsList, count, queryEn || null);

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
