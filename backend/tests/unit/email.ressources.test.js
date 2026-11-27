/* Chaque ressource que le gabarit fait charger part avec l'IP du lecteur :
   elles doivent toutes venir du site. */

import { describe, it, expect } from 'vitest';
import { renderEmail } from '../../src/services/emailTheme.js';

const html = renderEmail({ title: 'Titre', content: '<p>Corps</p>' });

describe('Ressources chargées par le gabarit des emails', () => {
  it('ne comptent aucune feuille de style externe', () => {
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/<link\b/i);
  });

  it('viennent toutes du site', () => {
    const adresses = [...html.matchAll(/(?:src="|url\(['"]?)([^"')]+)/g)].map((m) => m[1]);

    expect(adresses.length).toBeGreaterThan(0);
    for (const adresse of adresses) {
      expect(adresse.startsWith(`${process.env.FRONTEND_URL}/`)).toBe(true);
    }
  });
});
