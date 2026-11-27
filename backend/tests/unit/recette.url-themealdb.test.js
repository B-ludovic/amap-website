/* Un identifiant de recette lu dans l'URL publique ne doit pas ajouter de
   paramètre à la requête envoyée à TheMealDB. Express décode req.params :
   /api/recipes/52772%26c%3DDessert y arrive sous la forme « 52772&c=Dessert ». */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

vi.mock('google-translate-api-x', () => ({ default: async (texte) => ({ text: texte }) }));
vi.mock('../../src/config/database.js', () => ({ prisma: {} }));

const { default: recipeService } = await import('../../src/services/recipe.service.js');
const { getRecipeById } = await import('../../src/controllers/recipes.controller.js');

const INJECTE = '52772&c=Dessert';
const ATTENDU = 'https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772%26c%3DDessert';

let fetchFactice;

beforeEach(() => {
  fetchFactice = vi.fn(async () => ({ ok: false, status: 404 }));
  vi.stubGlobal('fetch', fetchFactice);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Identifiant transmis à TheMealDB', () => {
  it('encode l\'identifiant de la fiche demandée', async () => {
    await expect(recipeService.getRecipeDetails(INJECTE)).rejects.toThrow();

    expect(fetchFactice).toHaveBeenCalledWith(ATTENDU);
  });

  it('encode l\'identifiant d\'un plat repris d\'une recherche', async () => {
    await expect(recipeService.lookupMeal(INJECTE)).resolves.toBeNull();

    expect(fetchFactice).toHaveBeenCalledWith(ATTENDU);
  });
});

describe('Identifiant reçu par la route publique', () => {
  it.each([INJECTE, '52772abc', '-1', ' 52772', '052772', '0'])('refuse « %s » sans interroger TheMealDB', async (id) => {
    const { statut, message } = await appeler(getRecipeById, { params: { id } });

    expect(statut).toBe(400);
    expect(message).toBe('Identifiant de recette invalide');
    expect(fetchFactice).not.toHaveBeenCalled();
  });

  it('transmet un identifiant numérique', async () => {
    await appeler(getRecipeById, { params: { id: '52772' } });

    expect(fetchFactice).toHaveBeenCalledWith('https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772');
  });
});
