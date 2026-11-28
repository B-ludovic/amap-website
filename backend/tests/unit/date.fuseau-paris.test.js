/* Les dates écrites par le serveur suivent l'horloge de Paris, quel que soit le
   fuseau de la machine : l'hébergeur tourne en UTC. */

import { describe, it, expect } from 'vitest';

process.env.TZ = 'UTC';

const { formatDateFR } = await import('../../src/services/closure.service.js');

describe('formatDateFR', () => {
  it.each([
    ['23 h 30 UTC en hiver, déjà le lendemain à Paris', '2026-12-20T23:30:00Z', '21 décembre 2026'],
    ['22 h 30 UTC en été, déjà le lendemain à Paris', '2026-07-31T22:30:00Z', '1 août 2026'],
    ['une date du calendrier, minuit UTC', '2026-12-21', '21 décembre 2026'],
  ])('%s', (_cas, valeur, attendu) => {
    expect(formatDateFR(valeur)).toBe(attendu);
  });
});
