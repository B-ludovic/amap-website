/* Une recherche publique ne doit pas se changer en dizaines d'appels vers
   TheMealDB ou Google Translate : la boucle des suffixes est plafonnée, et les
   deux routes de recherche refusent une demande démesurée avant tout appel. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const traduire = vi.hoisted(() => vi.fn(async (texte) => ({ text: texte })));

vi.mock('google-translate-api-x', () => ({ default: traduire }));
vi.mock('../../src/config/database.js', () => ({ prisma: {} }));

const { default: recipeService } = await import('../../src/services/recipe.service.js');
const { searchRecipes, findRecipesByIngredients } = await import('../../src/controllers/recipes.controller.js');

let fetchFactice;

beforeEach(() => {
  fetchFactice = vi.fn(async () => ({ ok: true, json: async () => ({ meals: null }) }));
  vi.stubGlobal('fetch', fetchFactice);
  traduire.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Boucle des suffixes', () => {
  it('s\'arrête à six tentatives sur un terme long', async () => {
    await expect(recipeService.searchRecipes('z'.repeat(60))).resolves.toEqual([]);

    expect(fetchFactice).toHaveBeenCalledTimes(1 + 6);
  });

  it('essaie encore tous les suffixes d\'un mot court', async () => {
    await recipeService.searchRecipes('eggplant');

    const termes = fetchFactice.mock.calls.map(([url]) => new URL(url).searchParams.get('s'));
    expect(termes).toEqual(['eggplant', 'ggplant', 'gplant', 'plant', 'lant']);
  });
});

describe('Terme reçu par la route publique', () => {
  it.each([
    ['un terme de 61 caractères', { query: 'a'.repeat(61) }],
    ['un terme répété en tableau', { query: ['tomate', 'radis'] }],
    ['un terme anglais de 61 caractères', { query: 'tomate', queryEn: 'a'.repeat(61) }],
  ])('refuse %s sans appel sortant', async (_cas, query) => {
    const { statut, message } = await appeler(searchRecipes, { query });

    expect(statut).toBe(400);
    expect(message).toBe('La recherche est limitée à 60 caractères');
    expect(fetchFactice).not.toHaveBeenCalled();
    expect(traduire).not.toHaveBeenCalled();
  });

  it('transmet un terme de 60 caractères', async () => {
    const { statut } = await appeler(searchRecipes, { query: { query: 'z'.repeat(60) } });

    expect(statut).toBe(200);
    expect(fetchFactice).toHaveBeenCalled();
  });
});

describe('Ingrédients reçus par la route publique', () => {
  it.each([
    ['un texte de 61 caractères', { ingredients: 'a'.repeat(61) }, 'La recherche est limitée à 60 caractères'],
    ['des ingrédients répétés en tableau', { ingredients: ['tomate', 'radis'] }, 'La recherche est limitée à 60 caractères'],
    ['un terme anglais de 61 caractères', { ingredients: 'tomate', queryEn: 'a'.repeat(61) }, 'La recherche est limitée à 60 caractères'],
    ['six ingrédients', { ingredients: 'a,b,c,d,e,f' }, 'Indiquez entre 1 et 5 ingrédients'],
    ['une liste sans ingrédient', { ingredients: ' , ,' }, 'Indiquez entre 1 et 5 ingrédients'],
    ['treize recettes', { ingredients: 'tomate', number: '13' }, 'Le nombre de recettes demandé va de 1 à 12'],
    ['zéro recette', { ingredients: 'tomate', number: '0' }, 'Le nombre de recettes demandé va de 1 à 12'],
    ['un nombre illisible', { ingredients: 'tomate', number: 'abc' }, 'Le nombre de recettes demandé va de 1 à 12'],
  ])('refuse %s sans appel sortant', async (_cas, query, attendu) => {
    const { statut, message } = await appeler(findRecipesByIngredients, { query });

    expect(statut).toBe(400);
    expect(message).toBe(attendu);
    expect(fetchFactice).not.toHaveBeenCalled();
    expect(traduire).not.toHaveBeenCalled();
  });

  it('transmet cinq ingrédients et douze recettes', async () => {
    const { statut } = await appeler(findRecipesByIngredients, {
      query: { ingredients: 'tomate, radis, chou, ail, oignon', number: '12' },
    });

    expect(statut).toBe(200);
    expect(fetchFactice).toHaveBeenCalled();
  });
});
