import { describe, it, expect } from 'vitest';
import { filterMembers, matchesSearch } from '../../src/lib/memberSearch.js';

const LIGNE = 'Müller Zoé — zoe.muller@example.org';

describe('Ce qu\'on tape retrouve la bonne personne', () => {
  it('sans accents ni majuscules', () => {
    expect(matchesSearch(LIGNE, 'zoe')).toBe(true);
    expect(matchesSearch(LIGNE, 'MULLER')).toBe(true);
  });

  it('dans n\'importe quel ordre', () => {
    expect(matchesSearch(LIGNE, 'zoe muller')).toBe(true);
    expect(matchesSearch(LIGNE, 'muller zoe')).toBe(true);
  });

  it('par l\'adresse email', () => {
    expect(matchesSearch(LIGNE, 'zoe.muller@')).toBe(true);
  });

  it('exige chaque mot tapé', () => {
    expect(matchesSearch(LIGNE, 'zoe dupont')).toBe(false);
  });

  it('laisse tout passer quand rien n\'est tapé', () => {
    expect(matchesSearch(LIGNE, '')).toBe(true);
    expect(matchesSearch(LIGNE, '   ')).toBe(true);
  });
});

describe('L\'écran de distribution garde sa règle', () => {
  const lignes = [
    { subscriptionNumber: 'SUB-2026-001', user: { firstName: 'Zoé', lastName: 'Müller', email: 'zoe@example.org', phone: '0612345678' } },
    { subscriptionNumber: 'SUB-2026-002', user: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.org', phone: '0698765432' } },
  ];

  it('filtre par nom, numéro d\'abonnement ou téléphone', () => {
    expect(filterMembers(lignes, 'dupont jean')).toEqual([lignes[1]]);
    expect(filterMembers(lignes, 'sub-2026-001')).toEqual([lignes[0]]);
    expect(filterMembers(lignes, '5432')).toEqual([lignes[1]]);
  });

  it('rend toute la liste quand la recherche est vide', () => {
    expect(filterMembers(lignes, '  ')).toBe(lignes);
  });
});
