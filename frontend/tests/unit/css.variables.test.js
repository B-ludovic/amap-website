/* Une variable CSS jamais définie ne casse rien à l'écran : la propriété retombe
   sur sa valeur héritée ou initiale, sans erreur. Des fonds transparents et des
   alertes privées de leur rouge sont passés inaperçus ainsi. */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

// Posée par React Aria sur ses éléments flottants, au moment de l'affichage.
const DEFINIES_A_L_EXECUTION = ['--trigger-width'];

const fichiers = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = join(dossier, entree.name);
  if (entree.isDirectory()) return fichiers(chemin);
  return /\.(css|js)$/.test(entree.name) ? [chemin] : [];
});

const tous = fichiers(SRC);

const definies = new Set(DEFINIES_A_L_EXECUTION);
for (const chemin of tous) {
  const source = readFileSync(chemin, 'utf8');
  // « --nom: valeur » en CSS, « '--nom': valeur » dans un style en ligne.
  for (const [, nom] of source.matchAll(/(--[\w-]+)['"]?\s*:/g)) definies.add(nom);
  // next/font : variable: '--font-…'
  for (const [, nom] of source.matchAll(/variable:\s*['"](--[\w-]+)['"]/g)) definies.add(nom);
}

const orphelines = tous
  .filter((chemin) => chemin.endsWith('.css'))
  .flatMap((chemin) => [...readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\(\s*(--[\w-]+)/g)]
    .map(([, nom]) => nom)
    .filter((nom) => !definies.has(nom))
    .map((nom) => `${nom} dans ${relative(SRC, chemin)}`));

describe('Les feuilles de style', () => {
  it('n\'utilisent que des variables définies quelque part', () => {
    expect([...new Set(orphelines)]).toEqual([]);
  });
});
