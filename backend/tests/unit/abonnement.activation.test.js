/* La remise des chèques active le contrat — et le dit.

   C'est le second temps promis par le message d'enregistrement, qui annonce une
   activation « à réception de votre règlement ». Sans ce message-là, l'adhérente
   n'apprend jamais que la réception a eu lieu. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, confirmations } = vi.hoisted(() => ({
  base: { contrat: null, chequesEcrits: 0 },
  confirmations: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendSubscriptionConfirmation: async (subscription, user) => {
      confirmations.push({ subscription, user });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/contract.service.js', () => ({ default: {} }));

/* Prisma rend des objets détachés : ce qu'une lecture a renvoyé ne bouge plus
   quand une écriture suit. Le contrôleur compare justement l'avant et l'après,
   d'où les copies — un mock qui muterait la lecture lui ferait voir un contrat
   déjà actif avant même la remise. */
const tx = {
  payment: {
    create: async ({ data }) => ({ id: `paiement-${base.chequesEcrits++}`, ...data }),
    aggregate: async () => ({ _sum: { amount: base.contrat.price } }),
  },
  subscription: {
    update: async ({ data }) => ({ ...Object.assign(base.contrat, data) }),
    findUnique: async () => ({ ...base.contrat }),
  },
};

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $transaction: async (fn) => fn(tx),
    subscription: { findUnique: async () => ({ ...base.contrat }) },
  },
}));

const { recordChequesReceived } = await import('../../src/controllers/subscriptions.controller.js');

const contrat = (statut) => ({
  id: 'contrat-0001',
  subscriptionNumber: 'AMAP-2026-0142',
  type: 'ANNUAL',
  basketSize: 'SMALL',
  pricingType: 'NORMAL',
  status: statut,
  price: 931,
  paidAmount: 0,
  startDate: new Date('2026-01-07T12:00:00Z'),
  payments: [],
  user: { id: 'user-0001', email: 'camille@example.org', firstName: 'Camille' },
  pickupLocation: { name: 'Salle des fêtes', address: '2 place de la Mairie, 45300 Yèvre-la-Ville' },
});

const remettre = () => appeler(recordChequesReceived, {
  params: { id: 'contrat-0001' },
  body: { paymentType: '4' },
  user: { id: 'admin-0001' },
});

beforeEach(() => {
  confirmations.length = 0;
  base.chequesEcrits = 0;
  base.contrat = contrat('PENDING');
});

describe('Un contrat qui bascule à la remise des chèques', () => {
  it('annonce enfin l\'activation à l\'adhérente', async () => {
    const { statut } = await remettre();

    expect(statut).toBe(201);
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0].subscription.status).toBe('ACTIVE');
    expect(confirmations[0].user.email).toBe('camille@example.org');
  });

  /* Le gabarit lit le point de retrait : `updated` sort de la transaction sans
     ses relations, et un objet incomplet ferait tomber la requête en 500 après
     que les chèques sont écrits — la seconde tentative se heurterait alors au
     garde « déjà enregistrés ». */
  it('lui transmet un contrat complet, point de retrait compris', async () => {
    await remettre();

    expect(confirmations[0].subscription.pickupLocation.name).toBe('Salle des fêtes');
    expect(confirmations[0].subscription.subscriptionNumber).toBe('AMAP-2026-0142');
  });

  it('n\'écrit rien quand le contrat était déjà actif', async () => {
    base.contrat = contrat('ACTIVE');

    const { statut } = await remettre();

    expect(statut).toBe(201);
    expect(confirmations).toHaveLength(0);
  });
});
