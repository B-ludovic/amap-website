import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import nextConfig from '../../next.config.mjs';
import { proxy } from '../../src/proxy.js';

const FIXES = [
  'Strict-Transport-Security',
  'Cross-Origin-Opener-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
];

describe('En-têtes de sécurité', () => {
  it('pose les en-têtes fixes sur toutes les routes, fichiers exclus du proxy compris', async () => {
    const regles = await nextConfig.headers();
    const globale = regles.find(regle => regle.source === '/:path*');

    expect(globale).toBeDefined();
    expect(globale.headers.map(entete => entete.key)).toEqual(expect.arrayContaining(FIXES));
  });

  // Un en-tête émis deux fois se lit « same-origin, same-origin » : COOP invalide.
  it('laisse au proxy la seule CSP, sans doubler les en-têtes fixes', async () => {
    const response = await proxy(new NextRequest('https://auxptitspois.fr/'));

    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'nonce-");
    for (const cle of FIXES) expect(response.headers.has(cle)).toBe(false);
  });
});
