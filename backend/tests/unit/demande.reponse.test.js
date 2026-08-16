/* La réponse à une demande d'abonnement.

   Une demande mise en attente ou refusée ne laissait aucune trace chez son
   auteur : il attendait une réponse qui ne venait jamais. Ce qui se vérifie ici,
   c'est qu'elle part au bon moment — et une seule fois. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, messages } = vi.hoisted(() => ({
  base: { demande: null },
  messages: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendSubscriptionRequestWaitlisted: async (request) => {
      messages.push({ type: 'attente', email: request.email });
      return { success: true };
    },
    sendSubscriptionRequestRejected: async (request) => {
      messages.push({ type: 'refus', email: request.email });
      return { success: true };
    },
  },
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    subscriptionRequest: {
      findUnique: async () => ({ ...base.demande }),
      update: async ({ data }) => Object.assign(base.demande, data),
    },
  },
}));

const { updateRequestStatus } = await import('../../src/controllers/subscription-requests.controller.js');

const changerVers = (status, adminNotes) => appeler(updateRequestStatus, {
  params: { id: 'demande-0001' },
  body: { status, adminNotes },
  user: { id: 'admin-0001' },
});

beforeEach(() => {
  messages.length = 0;
  base.demande = {
    id: 'demande-0001',
    email: 'camille@example.org',
    firstName: 'Camille',
    type: 'ANNUAL',
    basketSize: 'SMALL',
    status: 'PENDING',
    adminNotes: null,
    userId: 'user-0001',
  };
});

describe('Une demande qui change d\'état le fait savoir', () => {
  it('prévient la mise en liste d\'attente', async () => {
    const { statut } = await changerVers('IN_PROGRESS');

    expect(statut).toBe(200);
    expect(messages).toEqual([{ type: 'attente', email: 'camille@example.org' }]);
  });

  it('prévient le refus, comme le fait déjà une candidature de producteur', async () => {
    await changerVers('REJECTED');

    expect(messages).toEqual([{ type: 'refus', email: 'camille@example.org' }]);
  });

  it('n\'écrit rien pour un simple retour en attente', async () => {
    base.demande.status = 'IN_PROGRESS';

    await changerVers('PENDING');

    expect(messages).toHaveLength(0);
  });
});

describe('Écrire une note n\'est pas répondre', () => {
  /* Le bouton « Enregistrer les notes » repasse le statut courant : sans garde,
     chaque note écrite sur une demande refusée renverrait le refus. */
  it('ne renvoie pas le refus à chaque note enregistrée', async () => {
    base.demande.status = 'REJECTED';

    await changerVers('REJECTED', 'Rappelée le 12, sans réponse');
    await changerVers('REJECTED', 'Relance envoyée');

    expect(messages).toHaveLength(0);
    expect(base.demande.adminNotes).toBe('Relance envoyée');
  });

  it('ne renvoie pas non plus l\'avis de liste d\'attente', async () => {
    base.demande.status = 'IN_PROGRESS';

    await changerVers('IN_PROGRESS', 'Place possible en mars');

    expect(messages).toHaveLength(0);
  });
});
