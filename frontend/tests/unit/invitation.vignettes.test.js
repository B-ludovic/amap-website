import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware.js';

/* Le middleware lit sa configuration sur process.env : la suite la pose et la
   retire elle-même, pour qu'un .env.local sur la machine ne décide de rien. */
const CLES = ['INVITE_EMAILS', 'INVITE_PASSWORD', 'INVITE_SECRET'];
let initial;

const appelle = chemin => middleware(new NextRequest(new URL(chemin, 'https://auxptitspois.fr')));

const reecritVers = response => response.headers.get('x-middleware-rewrite');

beforeEach(() => {
  initial = Object.fromEntries(CLES.map(cle => [cle, process.env[cle]]));
  process.env.INVITE_EMAILS = 'bureau@auxptitspois.test';
  process.env.INVITE_PASSWORD = 'sésame';
  process.env.INVITE_SECRET = 'secret-de-test-sans-valeur-hors-de-cette-suite';
});

afterEach(() => {
  for (const cle of CLES) {
    if (initial[cle] === undefined) delete process.env[cle];
    else process.env[cle] = initial[cle];
  }
});

describe('Vignettes de partage face à la porte', () => {
  it('laisse passer la vignette Open Graph sans laissez-passer', async () => {
    expect(reecritVers(await appelle('/opengraph-image?908a28c3'))).toBeNull();
  });

  it('laisse passer la vignette Twitter sans laissez-passer', async () => {
    expect(reecritVers(await appelle('/twitter-image'))).toBeNull();
  });

  it('continue de fermer les pages du site au même visiteur', async () => {
    expect(reecritVers(await appelle('/'))).toContain('/invitation');
    expect(reecritVers(await appelle('/nos-abonnements'))).toContain('/invitation');
  });

  it('ne laisse pas un chemin qui commence pareil se faire passer pour une vignette', async () => {
    expect(reecritVers(await appelle('/opengraph-image/compte'))).toContain('/invitation');
    expect(reecritVers(await appelle('/twitter-image-secret'))).toContain('/invitation');
  });
});
