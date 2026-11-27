/* Les routes d'écriture de l'admin — permanences, panier hebdomadaire,
   newsletters, fermetures, absences des fermes — contrôlent chaque champ en
   type, en format et en longueur avant d'atteindre la base. Un corps mal formé
   sort en 400 avec son message, sans qu'aucune requête Prisma ne parte. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';
import { HttpBadRequestError } from '../../src/utils/httpErrors.js';
import {
  ShiftSchema,
  UpdateShiftSchema,
  WeeklyBasketSchema,
  UpdateWeeklyBasketSchema,
  NewsletterSchema,
  UpdateNewsletterSchema,
  ClosureSchema,
  ProducerAbsenceSchema,
  UpdateProducerAbsenceSchema,
} from '../../src/utils/validation.schemas.js';

const { appels } = vi.hoisted(() => ({ appels: [] }));

vi.mock('../../src/config/database.js', () => {
  const modele = (nom) => new Proxy({}, {
    get: (_cible, operation) => async () => {
      appels.push(`${nom}.${String(operation)}`);
      return null;
    },
  });

  return { prisma: new Proxy({}, { get: (_cible, nom) => modele(String(nom)) }) };
});
vi.mock('../../src/services/email.service.js', () => ({ default: {} }));
vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

const { createShift, updateShift } = await import('../../src/controllers/shifts.controller.js');
const { createWeeklyBasket, updateWeeklyBasket } = await import('../../src/controllers/weekly-baskets.controller.js');
const { createNewsletter, updateNewsletter } = await import('../../src/controllers/newsletters.controller.js');
const { createClosure, updateClosure } = await import('../../src/controllers/closures.controller.js');
const { createProducerAbsence, updateProducerAbsence } = await import('../../src/controllers/producer-absences.controller.js');

const ID = '3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b9c';

// La forme exacte de ce qu'envoient ShiftModal, NewsletterModal, ClosureModal et la fiche producteur.
const permanence = {
  distributionDate: '2026-12-02',
  startTime: '18:15',
  endTime: '19:15',
  volunteersNeeded: 2,
  notes: null,
  volunteers: [{ userId: ID, role: null, status: 'CONFIRMED' }],
};
const newsletter = { subject: 'Le panier de la semaine', type: 'GENERAL', target: 'ALL', content: '<p>Bonjour</p>' };
const fermeture = { startDate: '2026-12-21', endDate: '2026-12-27', reason: undefined, notify: true };
const absence = { producerId: ID, startDate: '2026-12-07', endDate: '2026-12-07', reason: '' };

beforeEach(() => {
  appels.length = 0;
});

describe('Un corps mal formé est refusé avant la base', () => {
  const avecId = (body) => ({ params: { id: ID }, body });

  it.each([
    ['permanence sans date', createShift, { body: { ...permanence, distributionDate: undefined } },
      'Date de distribution requise'],
    ['permanence au 31 février', createShift, { body: { ...permanence, distributionDate: '2026-02-31' } },
      'Date invalide'],
    ['permanence, nombre de bénévoles en texte', createShift, { body: { ...permanence, volunteersNeeded: '3' } },
      'Nombre de bénévoles invalide'],
    ['permanence, bénévole donné en objet', createShift,
      { body: { ...permanence, volunteers: [{ userId: { not: null } }] } }, 'Bénévole invalide'],
    ['permanence modifiée, heure hors du cadran', updateShift, avecId({ startTime: '25:00' }),
      'Heure de début invalide (HH:MM)'],
    ['permanence modifiée, notes trop longues', updateShift, avecId({ notes: 'x'.repeat(2001) }),
      'Notes : 2000 caractères maximum'],
    ['permanence modifiée, bénévole posé en proposition', updateShift,
      avecId({ volunteers: [{ userId: ID, status: 'PENDING' }] }), 'Statut de bénévole invalide'],
    ['panier sans date', createWeeklyBasket, { body: {} }, 'Date de distribution requise'],
    ['panier, notes en tableau', createWeeklyBasket,
      { body: { distributionDate: '2026-12-02', notes: ['a'] } }, 'Notes invalide'],
    ['panier modifié, date en toutes lettres', updateWeeklyBasket, avecId({ distributionDate: 'demain' }),
      'Date invalide'],
    ['newsletter, objet blanc', createNewsletter, { user: { id: ID }, body: { ...newsletter, subject: '   ' } },
      'Objet requis'],
    ['newsletter, objet trop long', createNewsletter,
      { user: { id: ID }, body: { ...newsletter, subject: 'x'.repeat(201) } }, 'Objet : 200 caractères maximum'],
    ['newsletter, type inconnu', createNewsletter, { user: { id: ID }, body: { ...newsletter, type: 'SPAM' } },
      'Type de newsletter invalide'],
    ['newsletter modifiée, destinataires inconnus', updateNewsletter, avecId({ target: 'TOUS' }),
      'Destinataires invalides'],
    ['fermeture, motif trop long', createClosure, { body: { ...fermeture, reason: 'x'.repeat(501) } },
      'Motif : 500 caractères maximum'],
    ['fermeture, annonce en texte', createClosure, { body: { ...fermeture, notify: 'oui' } },
      'Choix d\'annonce invalide'],
    ['fermeture modifiée sans date de fin', updateClosure, avecId({ ...fermeture, endDate: undefined }),
      'Date de fin requise'],
    ['absence, ferme donnée en filtre', createProducerAbsence,
      { body: { ...absence, producerId: { in: [ID] } } }, 'Ferme requise'],
    ['absence modifiée, motif en nombre', updateProducerAbsence, avecId({ reason: 42 }), 'Motif invalide'],
  ])('%s', async (_cas, controleur, req, attendu) => {
    const { erreur, statut, message } = await appeler(controleur, { params: {}, ...req });

    expect(erreur).toBeInstanceOf(HttpBadRequestError);
    expect(statut).toBe(400);
    expect(message).toBe(attendu);
    expect(appels).toEqual([]);
  });
});

describe('Ce qu\'envoient les formulaires admin passe tel quel', () => {
  it('la permanence', () => {
    expect(ShiftSchema.safeParse(permanence).data).toEqual(permanence);
  });

  it('la permanence modifiée garde notes à null, qui efface la note en base', () => {
    expect(UpdateShiftSchema.safeParse({ notes: null }).data).toEqual({ notes: null });
  });

  it('le panier créé à une date ISO complète', () => {
    const distributionDate = new Date('2026-12-02T17:00:00.000Z').toISOString();

    expect(WeeklyBasketSchema.safeParse({ distributionDate }).success).toBe(true);
  });

  it('les notes du panier vidées restent une chaîne vide', () => {
    expect(UpdateWeeklyBasketSchema.safeParse({ notes: '' }).data).toEqual({ notes: '' });
  });

  it('la newsletter', () => {
    expect(NewsletterSchema.safeParse(newsletter).data).toEqual(newsletter);
  });

  it('la newsletter déprogrammée garde scheduledFor à null', () => {
    expect(UpdateNewsletterSchema.safeParse({ ...newsletter, scheduledFor: null }).data.scheduledFor).toBeNull();
  });

  it('la fermeture sans motif', () => {
    expect(ClosureSchema.safeParse(fermeture).success).toBe(true);
  });

  it('l\'absence d\'un jour, et son motif effacé à la modification', () => {
    expect(ProducerAbsenceSchema.safeParse(absence).success).toBe(true);
    expect(UpdateProducerAbsenceSchema.safeParse({ reason: null }).data).toEqual({ reason: null });
  });
});
