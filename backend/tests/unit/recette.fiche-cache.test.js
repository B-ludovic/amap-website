/* Une fiche coûte une consultation TheMealDB et une trentaine de traductions.
   Servie une fois, elle reste en cache un jour, sauf si elle est restée en
   anglais ou n'a pas pu être lue. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const traduire = vi.hoisted(() => vi.fn(async (texte) => ({ text: `[fr] ${texte}` })));

vi.mock('google-translate-api-x', () => ({ default: traduire }));

const UN_JOUR = 24 * 60 * 60 * 1000;

const plat = (id) => ({
  idMeal: id,
  strMeal: `Plat ${id}`,
  strMealThumb: 'https://www.themealdb.com/images/media/meals/plat.jpg',
  strCategory: 'Beef',
  strArea: 'French',
  strInstructions: 'Cut the onions.\r\nCook gently.',
  strIngredient1: 'Onion',
  strMeasure1: '2',
});

let recipeService;
let fetchFactice;

beforeEach(async () => {
  vi.resetModules();
  ({ default: recipeService } = await import('../../src/services/recipe.service.js'));

  fetchFactice = vi.fn(async (url) => {
    const id = new URL(url).searchParams.get('i');
    return { ok: true, json: async () => ({ meals: id === '99999' ? null : [plat(id)] }) };
  });
  vi.stubGlobal('fetch', fetchFactice);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  traduire.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Cache des fiches', () => {
  it('ne relit ni ne retraduit une fiche déjà servie', async () => {
    const premiere = await recipeService.getRecipeDetails('52772');
    const traductions = traduire.mock.calls.length;
    const seconde = await recipeService.getRecipeDetails('52772');

    expect(seconde).toBe(premiere);
    expect(fetchFactice).toHaveBeenCalledTimes(1);
    expect(traduire).toHaveBeenCalledTimes(traductions);
  });

  it('partage une seule traduction entre deux visites simultanées', async () => {
    await Promise.all([
      recipeService.getRecipeDetails('52772'),
      recipeService.getRecipeDetails('52772'),
    ]);

    expect(fetchFactice).toHaveBeenCalledTimes(1);
  });

  it('ne garde pas une fiche introuvable', async () => {
    await expect(recipeService.getRecipeDetails('99999')).rejects.toThrow('Recipe not found');
    await expect(recipeService.getRecipeDetails('99999')).rejects.toThrow('Recipe not found');

    expect(fetchFactice).toHaveBeenCalledTimes(2);
  });

  it('sert une fiche restée en anglais sans la garder', async () => {
    traduire.mockRejectedValueOnce(new Error('Too Many Requests'));

    const degradee = await recipeService.getRecipeDetails('52772');
    const reprise = await recipeService.getRecipeDetails('52772');

    expect(degradee.title).toBe('Plat 52772');
    expect(reprise.title).toBe('[fr] Plat 52772');
    expect(fetchFactice).toHaveBeenCalledTimes(2);
  });

  it('retraduit une fiche au bout d\'un jour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-27T08:00:00Z'));
    await recipeService.getRecipeDetails('52772');

    vi.setSystemTime(Date.now() + UN_JOUR - 1);
    await recipeService.getRecipeDetails('52772');
    expect(fetchFactice).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1);
    await recipeService.getRecipeDetails('52772');
    expect(fetchFactice).toHaveBeenCalledTimes(2);
  });

  it('ne garde que les mille fiches les plus récentes', async () => {
    const ids = Array.from({ length: 1001 }, (_, rang) => String(60000 + rang));
    for (const id of ids) await recipeService.getRecipeDetails(id);

    await recipeService.getRecipeDetails(ids.at(-1));
    expect(fetchFactice).toHaveBeenCalledTimes(1001);

    await recipeService.getRecipeDetails(ids[0]);
    expect(fetchFactice).toHaveBeenCalledTimes(1002);
  });
});
