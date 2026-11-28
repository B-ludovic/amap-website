import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '../../src/lib/redirect.js';

describe('Retour après connexion', () => {
  it.each([
    '/acces-producteur',
    '/demande-abonnement',
    '/compte?onglet=permanences',
  ])('suit le chemin du site %s', (chemin) => {
    expect(safeRedirectPath(chemin)).toBe(chemin);
  });

  it.each([
    ['une adresse absolue', 'https://exemple.org'],
    ['un chemin protocolaire', '//exemple.org'],
    ['une barre inverse', '/\\exemple.org'],
    ['une tabulation glissée', '/\t/exemple.org'],
    ['un retour à la ligne glissé', '/\n/exemple.org'],
    ['un script', 'javascript:alert(1)'],
    ['un chemin relatif', 'compte'],
    ['rien', null],
  ])('ramène à l\'accueil devant %s', (_cas, valeur) => {
    expect(safeRedirectPath(valeur)).toBe('/');
  });
});
