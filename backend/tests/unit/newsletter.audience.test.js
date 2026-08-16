/* À qui part une newsletter.

   Deux tris se superposent : l'opposition à la lettre d'information, qu'une
   alerte de service a le droit d'ignorer, et les adresses que le relais a
   déclarées mortes, qu'aucun message ne franchit — une alerte envoyée dans le
   vide n'alerte personne et abîme la réputation du domaine au passage. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { base } = vi.hoisted(() => ({
  base: { comptes: [], abonnements: [], adressesEcartees: [] },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findMany: async ({ where }) => base.comptes.filter((compte) =>
        (where.deletedAt === undefined || compte.deletedAt === where.deletedAt)
        && (where.newsletterOptIn === undefined || compte.newsletterOptIn === where.newsletterOptIn)
      ),
    },

    subscription: {
      findMany: async ({ where }) => base.abonnements.filter((abonnement) =>
        abonnement.status === where.status
        && (!where.pricingType || abonnement.pricingType === where.pricingType)
        && (where.user?.newsletterOptIn === undefined || abonnement.user.newsletterOptIn === where.user.newsletterOptIn)
      ),
    },

    emailSuppression: {
      findMany: async ({ where }) => base.adressesEcartees
        .filter((email) => where?.email?.in?.includes(email) ?? true)
        .map((email) => ({ email })),
    },
  },
}));

const { resolveNewsletterRecipients } = await import('../../src/services/newsletterAudience.service.js');

const compte = (i, options = {}) => ({
  id: `compte-${i}`,
  email: `adherent${i}@example.org`,
  firstName: 'Adhérent',
  deletedAt: null,
  newsletterOptIn: true,
  ...options,
});

beforeEach(() => {
  base.comptes = [compte(0), compte(1), compte(2)];
  base.abonnements = base.comptes.map((user) => ({ status: 'ACTIVE', pricingType: 'NORMAL', user }));
  base.adressesEcartees = [];
});

const adressesDe = async (options) => (await resolveNewsletterRecipients(options)).map((r) => r.email);

describe('La lettre d\'information ordinaire', () => {
  it('épargne qui s\'y est opposé', async () => {
    base.comptes[1].newsletterOptIn = false;

    expect(await adressesDe({ target: 'ALL', type: 'NEWSLETTER' }))
      .toEqual(['adherent0@example.org', 'adherent2@example.org']);
  });

  it('saute l\'adresse que le relais a déclarée morte', async () => {
    base.adressesEcartees = ['adherent1@example.org'];

    expect(await adressesDe({ target: 'ALL', type: 'NEWSLETTER' }))
      .toEqual(['adherent0@example.org', 'adherent2@example.org']);
  });
});

describe('L\'alerte de service', () => {
  it('passe outre l\'opposition : elle exécute le contrat', async () => {
    base.comptes[1].newsletterOptIn = false;

    expect(await adressesDe({ target: 'ALL', type: 'ALERT' })).toHaveLength(3);
  });

  /* Le seul tri qu'une alerte ne franchit pas : écrire à une boîte qui n'existe
     plus ne prévient personne, et fait monter le taux de rebond du domaine —
     donc menace l'arrivée des alertes suivantes, celles-là mêmes qu'on tient à
     faire passer. */
  it('ne force pas la porte d\'une adresse morte', async () => {
    base.adressesEcartees = ['adherent1@example.org'];

    expect(await adressesDe({ target: 'ALL', type: 'ALERT' }))
      .toEqual(['adherent0@example.org', 'adherent2@example.org']);
  });
});

describe('La liste dressée depuis les contrats', () => {
  it('écarte aussi les adresses mortes', async () => {
    base.adressesEcartees = ['adherent0@example.org'];

    expect(await adressesDe({ target: 'ACTIVE_SUBSCRIBERS', type: 'NEWSLETTER' }))
      .toEqual(['adherent1@example.org', 'adherent2@example.org']);
  });

  // Deux contrats sur la même personne ne font pas deux messages.
  it('ne garde qu\'une entrée par adhérent', async () => {
    base.abonnements.push({ status: 'ACTIVE', pricingType: 'NORMAL', user: base.comptes[0] });

    expect(await adressesDe({ target: 'ACTIVE_SUBSCRIBERS', type: 'NEWSLETTER' })).toHaveLength(3);
  });
});
