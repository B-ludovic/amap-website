/* Le balayage des newsletters programmées.

   Ce qui se vérifie ici : une date posée finit par partir, une seule fois, et
   un envoi manqué ne se rattrape pas indéfiniment. */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { base, envois } = vi.hoisted(() => ({
  base: { newsletters: [], utilisateurs: [], destinataires: [], resultat: null },
  envois: [],
}));

vi.mock('../../src/services/email.service.js', () => ({
  default: {
    sendNewsletter: async (newsletter, recipients) => {
      envois.push({ id: newsletter.id, adresses: recipients.map((r) => r.email) });

      const resultat = base.resultat ?? { sent: recipients.length, failed: 0, errors: [] };
      return { success: true, results: resultat };
    },
  },
}));

vi.mock('../../src/services/newsletterAudience.service.js', () => ({
  resolveNewsletterRecipients: async () => base.destinataires,
  overridesOptOut: (type) => type === 'ALERT',
}));

vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    newsletter: {
      findMany: async ({ where }) => base.newsletters.filter((n) =>
        n.scheduledFor !== null
        && n.scheduledFor <= where.scheduledFor.lte
        && where.status.in.includes(n.status)
      ),

      update: async ({ where, data }) => {
        const cible = base.newsletters.find((n) => n.id === where.id);
        Object.assign(cible, data);
        return cible;
      },

      // Compare-and-set : l'écriture n'est acceptée que si le statut est encore
      // un statut de départ au moment où elle s'exécute.
      updateMany: async ({ where, data }) => {
        const cible = base.newsletters.find((n) => n.id === where.id);
        if (!where.status.in.includes(cible.status)) return { count: 0 };

        Object.assign(cible, data);
        return { count: 1 };
      },
    },

    user: {
      findFirst: async ({ where }) => base.utilisateurs.find((u) => u.id === where.id && u.deletedAt === null) ?? null,
    },
  },
}));

const { envoyerNewslettersProgrammees } = await import('../../src/jobs/scheduledNewsletter.job.js');

const HEURE = 60 * 60 * 1000;
const ilYA = (ms) => new Date(Date.now() - ms);
const dans = (ms) => new Date(Date.now() + ms);

const lettre = (attributs = {}) => ({
  id: 'newsletter-0001',
  subject: 'La lettre de rentrée',
  content: '<p>Bonjour</p>',
  type: 'GENERAL',
  target: 'ALL',
  status: 'DRAFT',
  scheduledFor: null,
  sentAt: null,
  sentCount: 0,
  failedCount: 0,
  createdBy: 'admin-0001',
  ...attributs,
});

const ADHERENTS = Array.from({ length: 40 }, (_, i) => ({
  id: `u${i}`, email: `adherent${i}@example.org`, firstName: 'Adhérent',
}));

let journal;

beforeEach(() => {
  base.newsletters = [];
  base.utilisateurs = [{ id: 'admin-0001', email: 'sofia@example.org', firstName: 'Sofia', deletedAt: null }];
  base.destinataires = ADHERENTS;
  base.resultat = null;
  envois.length = 0;
  journal = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation((...a) => journal.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...a) => journal.push(a.join(' ')));
});

describe('Une date posée finit par partir', () => {
  it('envoie la newsletter dont l\'heure est passée', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(5 * 60 * 1000) })];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(1);
    expect(envois[0].adresses).toHaveLength(40);
    expect(base.newsletters[0].status).toBe('SENT');
    expect(base.newsletters[0].sentCount).toBe(40);
  });

  it('laisse tranquille celle dont l\'heure n\'est pas venue', async () => {
    base.newsletters = [lettre({ scheduledFor: dans(24 * HEURE) })];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(0);
    expect(base.newsletters[0].status).toBe('DRAFT');
  });

  it('ignore un brouillon sans date', async () => {
    base.newsletters = [lettre()];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(0);
  });
});

describe('La programmation se consomme au départ', () => {
  it('n\'envoie qu\'une fois, même si le balayage repasse', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(5 * 60 * 1000) })];

    await envoyerNewslettersProgrammees();
    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(1);
    expect(base.newsletters[0].scheduledFor).toBeNull();
  });

  /* Sans cette règle, une lettre en échec — quota du relais épuisé — repartirait
     à chaque quart d'heure sans que personne ne l'ait demandé. */
  it('ne relance pas d\'elle-même une lettre dont l\'envoi a échoué', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(5 * 60 * 1000) })];
    base.resultat = { sent: 0, failed: 40, errors: [] };

    await envoyerNewslettersProgrammees();
    expect(base.newsletters[0].status).toBe('FAILED');

    base.resultat = null;
    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(1);
    expect(base.newsletters[0].status).toBe('FAILED');
  });

  it('ne touche pas à une lettre dont l\'envoi est en cours', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(5 * 60 * 1000), status: 'SENDING' })];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(0);
  });
});

describe('Un rendez-vous trop ancien ne se rattrape pas', () => {
  it('repasse en brouillon au-delà d\'un jour de retard, sans rien envoyer', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(30 * HEURE) })];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(0);
    expect(base.newsletters[0].status).toBe('DRAFT');
    expect(base.newsletters[0].scheduledFor).toBeNull();
    expect(journal.join('\n')).toContain('périmée');
  });

  it('part encore avec quelques heures de retard', async () => {
    base.newsletters = [lettre({ scheduledFor: ilYA(6 * HEURE) })];

    await envoyerNewslettersProgrammees();

    expect(envois).toHaveLength(1);
    expect(base.newsletters[0].status).toBe('SENT');
  });
});

describe('La cible « test » programmée', () => {
  it('part à celle qui a rédigé la lettre', async () => {
    base.newsletters = [lettre({ target: 'TEST', scheduledFor: ilYA(5 * 60 * 1000) })];

    await envoyerNewslettersProgrammees();

    expect(envois[0].adresses).toEqual(['sofia@example.org']);
  });

  it('ne part à personne si le compte de l\'auteure a été purgé', async () => {
    base.utilisateurs = [];
    base.newsletters = [lettre({ target: 'TEST', scheduledFor: ilYA(5 * 60 * 1000) })];

    await envoyerNewslettersProgrammees();

    expect(envois[0].adresses).toEqual([]);
    expect(base.newsletters[0].status).toBe('SENT');
  });
});
