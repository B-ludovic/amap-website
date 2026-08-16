/* La réinitialisation du mot de passe prévient son propriétaire.

   C'est le seul signal dont dispose une adhérente dont la boîte email est
   compromise : sans lui, elle se découvre déconnectée sans savoir pourquoi. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { appeler } from '../helpers/expressFactice.js';

const { base, avis } = vi.hoisted(() => ({
  base: { adherente: null, envoiRefuse: false },
  avis: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendPasswordChanged: async (user) => {
      avis.push({ email: user.email, prenom: user.firstName });

      return base.envoiRefuse ? { success: false, error: 'quota exceeded' } : { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findFirst: async ({ where }) => {
        const cible = base.adherente;
        if (!cible || cible.resetToken !== where.resetToken) return null;

        return cible.resetTokenExpiry > where.resetTokenExpiry.gt ? cible : null;
      },

      update: async ({ where, data }) => {
        const cible = base.adherente;
        if (cible.id !== where.id) return null;

        const { tokenVersion, ...champs } = data;
        Object.assign(cible, champs, { tokenVersion: cible.tokenVersion + tokenVersion.increment });

        return cible;
      },
    },
  },
}));

const { resetPassword } = await import('../../src/controllers/auth.controller.js');

const JETON = 'jeton-de-reinitialisation';
const NOUVEAU = 'Fenouil-2026!';

const requete = (body) => ({ body, ip: '203.0.113.10' });

beforeEach(() => {
  avis.length = 0;
  base.envoiRefuse = false;
  base.adherente = {
    id: 'user-0001',
    email: 'camille@example.org',
    firstName: 'Camille',
    password: '$2a$12$ancienhachage',
    resetToken: crypto.createHash('sha256').update(JETON).digest('hex'),
    resetTokenExpiry: new Date(Date.now() + 30 * 60 * 1000),
    tokenVersion: 3,
  };
});

describe('Un mot de passe changé se dit à son propriétaire', () => {
  it('écrit à l\'adresse du compte après la réinitialisation', async () => {
    const { statut } = await appeler(resetPassword, requete({ token: JETON, password: NOUVEAU }));

    expect(statut).toBe(200);
    expect(avis).toEqual([{ email: 'camille@example.org', prenom: 'Camille' }]);
  });

  it('ne prévient personne quand le jeton ne vaut rien', async () => {
    const { statut, message } = await appeler(resetPassword, requete({ token: 'jeton-inventé', password: NOUVEAU }));

    expect(statut).toBe(400);
    expect(message).toBe('Token invalide ou expiré.');
    expect(avis).toHaveLength(0);
  });

  it('ne prévient personne quand le jeton a expiré', async () => {
    base.adherente.resetTokenExpiry = new Date(Date.now() - 60 * 1000);

    const { statut } = await appeler(resetPassword, requete({ token: JETON, password: NOUVEAU }));

    expect(statut).toBe(400);
    expect(avis).toHaveLength(0);
  });

  /* Le mot de passe est déjà écrit quand le message part : refuser la
     réinitialisation parce que le relais a dit non laisserait l'adhérente
     devant un formulaire en erreur, avec un compte pourtant changé. */
  it('tient la réinitialisation même si le message ne part pas', async () => {
    base.envoiRefuse = true;

    const { statut } = await appeler(resetPassword, requete({ token: JETON, password: NOUVEAU }));

    expect(statut).toBe(200);
    expect(base.adherente.password).not.toBe('$2a$12$ancienhachage');
    expect(base.adherente.resetToken).toBeNull();
  });
});

describe('Le jeton et les sessions ne survivent pas au changement', () => {
  it('efface le jeton et invalide les cookies déjà distribués', async () => {
    await appeler(resetPassword, requete({ token: JETON, password: NOUVEAU }));

    expect(base.adherente.resetToken).toBeNull();
    expect(base.adherente.resetTokenExpiry).toBeNull();
    expect(base.adherente.tokenVersion).toBe(4);
  });
});
