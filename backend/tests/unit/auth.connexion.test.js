/* Un compte supprimé reste en base jusqu'à sa purge, quatre-vingt-dix jours
   plus tard. Pendant ce temps, la connexion ne doit rien laisser deviner de
   lui : ni qu'il a existé, ni si le mot de passe essayé était le bon. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { appeler } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { adherente: null } }));

vi.mock('../../src/services/email.service.js', () => ({ default: {} }));
vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }) => {
        const cible = base.adherente;

        return cible && cible.email === where.email ? { ...cible } : null;
      },
    },
  },
}));

const { login } = await import('../../src/controllers/auth.controller.js');

const REFUS = 'Email ou mot de passe incorrect.';
const MOT_DE_PASSE = 'Fenouil-2026!';
const HACHAGE = bcrypt.hashSync(MOT_DE_PASSE, 10);

const connexion = (body) => appeler(login, { body, ip: '203.0.113.10', get: () => undefined });

beforeEach(() => {
  base.adherente = {
    id: 'user-0001',
    email: 'camille@example.org',
    firstName: 'Camille',
    lastName: 'Renard',
    role: 'MEMBER',
    password: HACHAGE,
    emailVerified: true,
    deletedAt: null,
    tokenVersion: 1,
  };
});

describe('Un compte supprimé répond comme une adresse inconnue', () => {
  it('refuse le bon mot de passe avec le message d\'un mot de passe faux', async () => {
    base.adherente.deletedAt = new Date();

    const { statut, message, erreur } = await connexion({ email: 'camille@example.org', password: MOT_DE_PASSE });

    expect(statut).toBe(401);
    expect(message).toBe(REFUS);
    expect(erreur.code).toBeUndefined();
  });

  it('refuse un mot de passe faux avec ce même message', async () => {
    base.adherente.deletedAt = new Date();

    const { statut, message } = await connexion({ email: 'camille@example.org', password: 'Persil-2025?' });

    expect(statut).toBe(401);
    expect(message).toBe(REFUS);
  });

  it('ne compare même pas le mot de passe', async () => {
    base.adherente.deletedAt = new Date();
    const comparaison = vi.spyOn(bcrypt, 'compare');

    await connexion({ email: 'camille@example.org', password: MOT_DE_PASSE });

    expect(comparaison).not.toHaveBeenCalled();
    comparaison.mockRestore();
  });

  it('répond comme pour une adresse qui n\'a jamais existé', async () => {
    const inconnue = await connexion({ email: 'inconnu@example.org', password: MOT_DE_PASSE });

    base.adherente.deletedAt = new Date();
    const supprimee = await connexion({ email: 'camille@example.org', password: MOT_DE_PASSE });

    expect(supprimee.statut).toBe(inconnue.statut);
    expect(supprimee.message).toBe(inconnue.message);
  });
});

describe('Un compte actif se connecte toujours', () => {
  it('accepte le bon mot de passe', async () => {
    const { statut, corps } = await connexion({ email: 'camille@example.org', password: MOT_DE_PASSE });

    expect(statut).toBe(200);
    expect(corps.data.user.email).toBe('camille@example.org');
  });
});
