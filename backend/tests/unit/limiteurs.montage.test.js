/* Les routes publiques qui coûtent plus qu'une lecture bornée ont un limiteur
   à elles, monté avant leur routeur : monté après, il ne verrait passer aucune
   requête. server.js démarre la base et le planificateur à l'import, d'où une
   lecture de son texte plutôt qu'un appel. */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/server.js', import.meta.url), 'utf8');

const montages = [...source.matchAll(/app\.(?:use|post)\('([^']+)',\s*(\w+)\)/g)]
  .map(([, chemin, nom], rang) => ({ chemin, nom, rang }));

const limiteursAvant = (url, routeur) => {
  const montageRouteur = montages.find((m) => m.nom === routeur);
  return montages
    .filter((m) => m.rang < montageRouteur.rang)
    .filter((m) => m.nom.endsWith('Limiter') && m.nom !== 'globalLimiter')
    .filter((m) => url === m.chemin || url.startsWith(`${m.chemin}/`))
    .map((m) => m.nom);
};

describe('Limiteurs dédiés des routes publiques', () => {
  it.each([
    ['/api/recipes/search', 'recipesRoutes', 'recipeLimiter'],
    ['/api/recipes/ingredients', 'recipesRoutes', 'recipeLimiter'],
    ['/api/recipes/suggestions/weekly-basket/42', 'recipesRoutes', 'recipeLimiter'],
    ['/api/recipes/52772', 'recipesRoutes', 'recipeLimiter'],
    ['/api/auth/confirm/jeton', 'authRoutes', 'publicLimiter'],
  ])('%s passe par %s puis %s', (url, routeur, limiteur) => {
    expect(limiteursAvant(url, routeur)).toContain(limiteur);
  });
});
