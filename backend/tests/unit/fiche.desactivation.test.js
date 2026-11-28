/* Une fiche à laquelle un compte producteur est rattaché ne se désactive pas :
   l'admin retire d'abord l'accès, explicitement. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, verrous } = vi.hoisted(() => ({
  base: { fiches: [], comptes: [], ecritures: 0 },
  verrous: [],
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/email.service.js', () => ({ default: {} }));

const ficheDe = (id) => base.fiches.find((f) => f.id === id);

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => travail(prisma),
    $queryRaw: async (morceaux, ...valeurs) => {
      verrous.push({ table: morceaux.join('?').match(/FROM "(\w+)"/)[1], id: valeurs[0] });
      return [];
    },
    producer: {
      findUnique: async ({ where }) => (where.id ? ficheDe(where.id) : base.fiches.find((f) => f.email === where.email)) ?? null,
      update: async ({ where, data }) => {
        base.ecritures += 1;
        return { ...Object.assign(ficheDe(where.id), data) };
      },
    },
    user: {
      count: async ({ where }) => base.comptes.filter((c) => c.producerId === where.producerId).length,
    },
  };

  return { prisma };
});

const { updateProducer } = await import('../../src/controllers/admin.controller.js');

const admin = { id: 'admin-0001', email: 'claire@example.org', role: 'ADMIN' };
const modifier = (body) => appeler(updateProducer, { params: { id: 'ferme-0001' }, body, user: admin });

beforeEach(() => {
  base.fiches = [{ id: 'ferme-0001', name: 'La Ferme des Lilas', email: 'lilas@example.org', isActive: true }];
  base.comptes = [{ id: 'user-0001', producerId: 'ferme-0001' }];
  base.ecritures = 0;
  verrous.length = 0;
});

describe('Désactivation d\'une fiche producteur', () => {
  it('refuse tant qu\'un compte y est rattaché, sous le verrou de la fiche', async () => {
    const { statut } = await modifier({ isActive: false });

    expect(statut).toBe(409);
    expect(ficheDe('ferme-0001').isActive).toBe(true);
    expect(base.ecritures).toBe(0);
    expect(verrous).toEqual([{ table: 'Producer', id: 'ferme-0001' }]);
  });

  it('désactive une fiche sans compte rattaché', async () => {
    base.comptes = [];
    const { statut } = await modifier({ isActive: false });

    expect(statut).toBe(200);
    expect(ficheDe('ferme-0001').isActive).toBe(false);
  });

  it('laisse modifier une fiche rattachée qui reste active', async () => {
    const { statut } = await modifier({ isActive: true, description: 'Maraîchage' });

    expect(statut).toBe(200);
    expect(ficheDe('ferme-0001').description).toBe('Maraîchage');
  });
});
