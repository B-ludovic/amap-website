/* L'annuaire qui alimente le choix d'un bénévole : tous les comptes actifs, et
   seulement de quoi les reconnaître. La liste paginée s'arrêtait aux vingt
   comptes les plus récents. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { comptes: [] } }));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findMany: async ({ where = {}, select, take }) => {
        const retenus = base.comptes
          .filter((compte) => !('deletedAt' in where) || compte.deletedAt === where.deletedAt)
          .slice(0, take ?? Infinity);

        return retenus.map((compte) => (select
          ? Object.fromEntries(Object.keys(select).map((champ) => [champ, compte[champ]]))
          : { ...compte }));
      },
    },
  },
}));

const { getUserDirectory } = await import('../../src/controllers/admin.controller.js');

const compte = (rang, attributs = {}) => ({
  id: `compte-${rang}`,
  firstName: `Prénom${rang}`,
  lastName: `Nom${rang}`,
  email: `adherent${rang}@example.org`,
  phone: '06 12 34 56 78',
  password: 'empreinte',
  role: 'MEMBER',
  deletedAt: null,
  ...attributs,
});

beforeEach(() => {
  base.comptes = Array.from({ length: 45 }, (_, rang) => compte(rang));
  base.comptes[3] = compte(3, { deletedAt: new Date('2026-09-01T00:00:00Z') });
  base.comptes[40] = compte(40, { deletedAt: new Date('2026-09-15T00:00:00Z') });
});

describe('L\'annuaire des comptes', () => {
  it('rend tous les comptes actifs, au-delà de vingt', async () => {
    const { statut, corps } = await appeler(getUserDirectory, { user: { id: 'admin-1', role: 'ADMIN' } });

    expect(statut).toBe(200);
    expect(corps.data).toHaveLength(43);
    expect(corps.data.map((c) => c.id)).not.toContain('compte-3');
    expect(corps.data.map((c) => c.id)).not.toContain('compte-40');
  });

  it('ne livre que de quoi reconnaître la personne', async () => {
    const { corps } = await appeler(getUserDirectory, { user: { id: 'admin-1', role: 'ADMIN' } });

    expect(Object.keys(corps.data[0]).sort()).toEqual(['email', 'firstName', 'id', 'lastName']);
  });
});
