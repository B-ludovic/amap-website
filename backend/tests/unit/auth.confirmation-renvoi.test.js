/* Le renvoi du lien de confirmation est la seule sortie de l'impasse : la
   connexion est refusée tant que l'adresse n'est pas confirmée, et le lien reçu
   à l'inscription expire au bout de 24 heures.

   Deux exigences se tiennent en tension ici. La page est publique, donc la
   réponse ne doit jamais laisser deviner qui possède un compte ; mais un
   inconnu ne doit pas non plus pouvoir arroser une boîte de messages en
   martelant le formulaire. D'où une réponse unique dans tous les cas, et un
   délai de garde entre deux envois. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { appeler } from '../helpers/expressFactice.js';

const { base, envois } = vi.hoisted(() => ({
  base: { adherente: null },
  envois: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendEmailVerification: async (user, token) => {
      envois.push({ email: user.email, token });

      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }) => {
        const cible = base.adherente;

        return cible && cible.email === where.email ? cible : null;
      },

      update: async ({ where, data }) => {
        const cible = base.adherente;
        if (cible.id !== where.id) return null;
        Object.assign(cible, data);

        return cible;
      },
    },
  },
}));

const { resendConfirmationEmail, login } = await import('../../src/controllers/auth.controller.js');

const REPONSE_MUETTE = 'Si un compte non confirmé existe avec cet email, un nouveau lien a été envoyé.';
const JOUR_MS = 24 * 60 * 60 * 1000;
const MOT_DE_PASSE = 'Fenouil-2026!';
const HACHAGE = bcrypt.hashSync(MOT_DE_PASSE, 10);

const requete = (body) => ({ body, ip: '203.0.113.10', get: () => undefined });

beforeEach(() => {
  envois.length = 0;
  base.adherente = {
    id: 'user-0001',
    email: 'camille@example.org',
    firstName: 'Camille',
    password: HACHAGE,
    emailVerified: false,
    emailVerifyToken: 'ancien-hachage',
    // Lien demandé la veille : le délai de garde est passé.
    emailVerifyTokenExpiry: new Date(Date.now() + JOUR_MS - 60 * 60 * 1000),
    tokenVersion: 1,
  };
});

describe('Le lien de confirmation se redemande', () => {
  it('envoie un nouveau lien au compte non confirmé', async () => {
    const { statut, message } = await appelerRenvoi({ email: 'camille@example.org' });

    expect(statut).toBe(200);
    expect(message).toBe(REPONSE_MUETTE);
    expect(envois).toHaveLength(1);
    expect(envois[0].email).toBe('camille@example.org');
  });

  it('remplace le jeton précédent, sans quoi l\'ancien message resterait valable', async () => {
    await appelerRenvoi({ email: 'camille@example.org' });

    expect(base.adherente.emailVerifyToken).not.toBe('ancien-hachage');
    expect(base.adherente.emailVerifyTokenExpiry.getTime()).toBeGreaterThan(Date.now() + JOUR_MS - 60 * 1000);
  });

  it('refuse une demande sans adresse', async () => {
    const { statut } = await appelerRenvoi({});

    expect(statut).toBe(400);
    expect(envois).toHaveLength(0);
  });
});

describe('La réponse ne dit pas qui possède un compte', () => {
  it('répond la même chose pour une adresse inconnue', async () => {
    const { statut, message } = await appelerRenvoi({ email: 'inconnu@example.org' });

    expect(statut).toBe(200);
    expect(message).toBe(REPONSE_MUETTE);
    expect(envois).toHaveLength(0);
  });

  it('répond la même chose pour un compte déjà confirmé', async () => {
    base.adherente.emailVerified = true;

    const { statut, message } = await appelerRenvoi({ email: 'camille@example.org' });

    expect(statut).toBe(200);
    expect(message).toBe(REPONSE_MUETTE);
    expect(envois).toHaveLength(0);
  });
});

describe('Le délai de garde empêche d\'arroser une boîte', () => {
  it('ne renvoie rien si un lien vient d\'être émis', async () => {
    base.adherente.emailVerifyTokenExpiry = new Date(Date.now() + JOUR_MS - 60 * 1000);

    const { statut, message } = await appelerRenvoi({ email: 'camille@example.org' });

    expect(statut).toBe(200);
    expect(message).toBe(REPONSE_MUETTE);
    expect(envois).toHaveLength(0);
  });

  it('renvoie de nouveau une fois les cinq minutes passées', async () => {
    base.adherente.emailVerifyTokenExpiry = new Date(Date.now() + JOUR_MS - 6 * 60 * 1000);

    await appelerRenvoi({ email: 'camille@example.org' });

    expect(envois).toHaveLength(1);
  });
});

/* Le front doit distinguer ce refus d'un mot de passe faux pour proposer le
   renvoi : tous deux sont des 401, seul le code les sépare. Le message, lui,
   sera réécrit un jour. */
describe('Le refus de connexion nomme sa cause', () => {
  it('porte le code EMAIL_NOT_VERIFIED quand l\'adresse n\'est pas confirmée', async () => {
    const { erreur, statut } = await appeler(login, requete({
      email: 'camille@example.org',
      password: MOT_DE_PASSE,
    }));

    expect(statut).toBe(401);
    expect(erreur.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

function appelerRenvoi(body) {
  return appeler(resendConfirmationEmail, requete(body));
}
