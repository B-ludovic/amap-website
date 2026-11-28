/* Les dates écrites par le serveur suivent l'horloge de Paris, quel que soit le
   fuseau de la machine : l'hébergeur tourne en UTC. */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { viderBoite, dernierMessage } from '../helpers/boiteDEnvoi.js';
import { adherente, contrat } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

process.env.TZ = 'UTC';

const { formatDateFR } = await import('../../src/services/closure.service.js');
const emails = (await import('../../src/services/email.service.js')).default;
const { parisYear } = await import('../../src/utils/parisDate.js');

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('formatDateFR', () => {
  it.each([
    ['23 h 30 UTC en hiver, déjà le lendemain à Paris', '2026-12-20T23:30:00Z', '21 décembre 2026'],
    ['22 h 30 UTC en été, déjà le lendemain à Paris', '2026-07-31T22:30:00Z', '1 août 2026'],
    ['une date du calendrier, minuit UTC', '2026-12-21', '21 décembre 2026'],
  ])('%s', (_cas, valeur, attendu) => {
    expect(formatDateFR(valeur)).toBe(attendu);
  });
});

describe('parisYear', () => {
  it('passe à l\'année suivante à minuit à Paris, une heure avant UTC', () => {
    expect(parisYear('2026-12-31T23:30:00Z')).toBe(2027);
    expect(parisYear('2026-12-31T22:30:00Z')).toBe(2026);
  });
});

describe('Dates des emails', () => {
  it('écrit les bornes d\'une pause à l\'heure de Paris', async () => {
    viderBoite();
    await emails.sendSubscriptionPaused(contrat, adherente, {
      startDate: '2026-07-31T22:30:00Z',
      endDate: '2026-12-20T23:30:00Z',
      joursRestants: 7,
    });

    expect(dernierMessage().html).toContain('du 1er août 2026 au 21 décembre 2026');
  });
});

/* Toute mise en forme de date par le serveur nomme son fuseau : un appel sans
   timeZone écrirait la date de l'hébergeur. */
describe('Aucune date mise en forme sans fuseau', () => {
  const racine = new URL('../../src/', import.meta.url).pathname;

  async function sources(dossier) {
    const entrees = await readdir(dossier, { withFileTypes: true });
    const fichiers = await Promise.all(entrees.map((entree) => {
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) return sources(chemin);
      return entree.name.endsWith('.js') ? [chemin] : [];
    }));
    return fichiers.flat();
  }

  // Le texte de l'appel, de sa parenthèse ouvrante à la fermante qui lui répond.
  function argumentsDe(texte, debut) {
    let profondeur = 0;
    for (let i = debut; i < texte.length; i += 1) {
      if (texte[i] === '(') profondeur += 1;
      if (texte[i] === ')' && --profondeur === 0) return texte.slice(debut, i + 1);
    }
    return texte.slice(debut);
  }

  it('dans backend/src', async () => {
    const fautifs = [];
    for (const fichier of await sources(racine)) {
      const texte = await readFile(fichier, 'utf8');
      for (const appel of texte.matchAll(/(?:toLocale(?:Date|Time)?String|Intl\.DateTimeFormat)\(/g)) {
        const args = argumentsDe(texte, appel.index + appel[0].length - 1);
        if (!args.includes('timeZone')) {
          const ligne = texte.slice(0, appel.index).split('\n').length;
          fautifs.push(`${fichier.replace(racine, '')}:${ligne}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });
});
