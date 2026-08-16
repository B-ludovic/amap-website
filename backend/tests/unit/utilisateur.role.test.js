/* Le changement de rôle se dit à la personne concernée.

   Un accès à l'administration s'ouvre ou se ferme sur-le-champ — le rôle est
   relu en base à chaque requête. Sans message, l'intéressé découvre un écran
   apparu ou disparu sans explication. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { boiteDEnvoi, viderBoite, viderRegistre, dernierMessage } from '../helpers/boiteDEnvoi.js';
import { adherente } from '../fixtures/destinataires.js';

vi.mock('nodemailer', async () => (await import('../helpers/boiteDEnvoi.js')).fauxNodemailer);
vi.mock('../../src/config/database.js', async () => (await import('../helpers/boiteDEnvoi.js')).fausseBase);

const emails = (await import('../../src/services/email.service.js')).default;

beforeEach(() => {
  viderBoite();
  viderRegistre();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('Devenir administrateur', () => {
  it('annonce l\'accès et la responsabilité qui va avec', async () => {
    await emails.sendRoleChanged(adherente, { role: 'ADMIN', ancienRole: 'MEMBER' });
    const { html } = dernierMessage();

    expect(html).toContain('espace d\'administration');
    expect(html).toContain('coordonnées, les contrats et les règlements des autres adhérents');
  });
});

describe('Perdre l\'administration', () => {
  it('dit ce qui est retiré, et ce qui ne l\'est pas', async () => {
    await emails.sendRoleChanged(adherente, { role: 'MEMBER', ancienRole: 'ADMIN' });
    const { html } = dernierMessage();

    expect(html).toContain('a été retiré');
    expect(html).toContain('votre abonnement n\'est pas touché');
    expect(html).not.toContain('Ouvrir l\'administration');
  });
});

describe('Passer bénévole', () => {
  /* VOLUNTEER n'ouvre aucune porte qu'un adhérent n'ait déjà : aucun contrôle
     d'accès ne le distingue de MEMBER. Le message annonce donc un libellé, et
     se garde de promettre des droits. */
  it('annonce le libellé sans promettre d\'accès', async () => {
    await emails.sendRoleChanged(adherente, { role: 'VOLUNTEER', ancienRole: 'MEMBER' });
    const { html } = dernierMessage();

    expect(html).toContain('« Bénévole »');
    expect(html).not.toContain('espace d\'administration');
    expect(boiteDEnvoi).toHaveLength(1);
  });
});
