/* Ce que dit la confirmation de contrat, selon que le règlement est arrivé.

   Un même gabarit sert deux scènes : l'administration qui active un contrat, et
   l'approbation d'une demande qui le laisse en attente. Annoncer une activation
   dans le second cas envoie l'adhérent à une distribution où il n'est sur
   aucune liste. */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { boiteDEnvoi, viderBoite, viderRegistre, dernierMessage } from '../helpers/boiteDEnvoi.js';
import { adherente, contrat, contratEnAttente } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  viderBoite();
  viderRegistre();
});

describe('Un contrat actif s\'annonce comme tel', () => {
  it('dit l\'activation, sans réclamer de règlement', async () => {
    await emails.sendSubscriptionConfirmation(contrat, adherente);
    const { subject, html } = dernierMessage();

    expect(subject).toBe('Votre abonnement est activé !');
    expect(html).toContain('<strong>activé</strong>');
    expect(html).not.toContain('Il reste une étape');
  });
});

describe('Un contrat en attente de règlement ne s\'annonce pas activé', () => {
  it('change de sujet et de promesse', async () => {
    await emails.sendSubscriptionConfirmation(contratEnAttente, adherente, { paymentType: '4' });
    const { subject, html } = dernierMessage();

    expect(subject).toBe('Votre abonnement est enregistré');
    expect(html).not.toContain('<strong>activé</strong>');
    expect(html).toContain('Il reste une étape');
  });

  /* La phrase qui évite le déplacement du mercredi soir : sans elle, le contrat
     paraît en ordre et l'adhérent se présente à une distribution qui ne l'attend
     pas. */
  it('dit qu\'aucun panier n\'est réservé tant que rien n\'est réglé', async () => {
    await emails.sendSubscriptionConfirmation(contratEnAttente, adherente, { paymentType: '1' });

    expect(dernierMessage().html).toContain('aucun panier ne vous est réservé');
  });

  it('détaille les chèques attendus selon la modalité choisie', async () => {
    await emails.sendSubscriptionConfirmation(contratEnAttente, adherente, { paymentType: '4' });
    // Format du contrat imprimé, espace insécable devant l'euro compris.
    expect(dernierMessage().html).toContain('3 chèques de 233,00 € et 1 chèque de 232,00 €');

    await emails.sendSubscriptionConfirmation(contratEnAttente, adherente, { paymentType: '1' });
    expect(dernierMessage().html).toContain('1 chèque de 931,00 €');
  });

  /* Le contrat ne porte pas la modalité — elle vient de la demande. Sans elle,
     le message reste vrai : il réclame le règlement sans inventer un découpage. */
  it('reste juste quand la modalité est inconnue', async () => {
    await emails.sendSubscriptionConfirmation(contratEnAttente, adherente);
    const { html } = dernierMessage();

    expect(html).toContain('par chèque à l\'ordre d\'Aux P\'tits Pois');
    expect(html).not.toMatch(/\d+ chèques? de/);
  });

  it('reste prudent devant un statut inattendu', async () => {
    await emails.sendSubscriptionConfirmation({ ...contrat, status: 'PAUSED' }, adherente);

    expect(dernierMessage().subject).toBe('Votre abonnement est enregistré');
    expect(boiteDEnvoi).toHaveLength(1);
  });
});
