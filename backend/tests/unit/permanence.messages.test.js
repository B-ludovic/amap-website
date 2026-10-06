/* Les messages d'une proposition de permanence : la confirmation dit comment se
   désister, le refus ne donne aucun motif. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { viderBoite, viderRegistre, dernierMessage } from '../helpers/boiteDEnvoi.js';
import { adherente, permanence } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;

const ESPACE_ADHERENT = 'https://auxptitspois.test/compte';

beforeEach(() => {
  viderBoite();
  viderRegistre();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('La confirmation de permanence', () => {
  it('donne la date dans l\'objet et dit comment se désister', async () => {
    await emails.sendShiftConfirmation(permanence, adherente);
    const { subject, html } = dernierMessage();

    expect(subject).toContain('2 septembre 2026');
    expect(html).toContain('48 heures');
    expect(html).toContain(ESPACE_ADHERENT);
  });
});

describe('Le refus d\'une proposition', () => {
  it('nomme la date et renvoie vers l\'espace adhérent', async () => {
    await emails.sendShiftRefusal(permanence, adherente);
    const { html } = dernierMessage();

    expect(html).toContain('2 septembre 2026');
    expect(html).toContain('n\'a pas été retenue');
    expect(html).toContain(ESPACE_ADHERENT);
  });

  /* Le refus est à la discrétion de l'admin : ni la place prise, ni la manière
     de tenir la distribution, ni l'entente avec les amapiens n'y sont évoquées.
     On lit la version texte : le gabarit porte « motif » dans le nom de son image de fond. */
  it('ne donne aucun motif', async () => {
    await emails.sendShiftRefusal(permanence, adherente);
    const { subject, text } = dernierMessage();

    expect(text).toContain('n\'a pas été retenue');
    for (const motif of ['complète', 'motif', 'raison', 'comportement']) {
      expect(text.toLowerCase()).not.toContain(motif);
    }
    expect(subject).not.toMatch(/refus/i);
  });
});

describe('L\'avis de désistement aux admins', () => {
  it('nomme la personne, la date et ce qu\'il reste à pourvoir', async () => {
    await emails.sendShiftWithdrawalNotice(
      permanence,
      { email: 'claire@example.org', firstName: 'Claire' },
      { volunteer: adherente, confirmedCount: 1 }
    );
    const { to, subject, text, html } = dernierMessage();

    expect(to).toBe('claire@example.org');
    expect(subject).toContain('2 septembre 2026');
    expect(text).toContain('Camille Renard');
    expect(text).toContain('1 sur 2');
    expect(html).toContain('https://auxptitspois.test/admin/permanences');
  });
});

describe('Le désistement', () => {
  it('renvoie vers l\'espace adhérent, et non vers une page inexistante', async () => {
    await emails.sendShiftWithdrawal(permanence, adherente);
    const { html } = dernierMessage();

    expect(html).toContain(ESPACE_ADHERENT);
    expect(html).not.toContain('/permanences');
  });
});
