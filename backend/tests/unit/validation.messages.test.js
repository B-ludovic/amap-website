/* Un refus de validation remonte à l'écran avec son message en français, et
   les données acceptées gardent leur forme : vide ramené à undefined, email
   normalisé, chaîne vide conservée là où elle efface un champ. */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { appeler, reponseFactice } from '../helpers/expressFactice.js';
import { HttpBadRequestError } from '../../src/utils/httpErrors.js';
import {
  RegisterSchema,
  ProducerSchema,
  UpdateProducerSchema,
  SubscriptionRequestSchema,
} from '../../src/utils/validation.schemas.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: async () => ({ id: 'adherente-0001' }) },
    subscription: { findUnique: async () => ({ id: 'contrat-0001' }) },
  },
}));
vi.mock('../../src/services/email.service.js', () => ({ default: {} }));
vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));
vi.mock('../../src/services/contract.service.js', () => ({ default: {} }));
vi.mock('../../src/services/reauth.service.js', () => ({ confirmPassword: async () => {} }));
vi.mock('../../src/services/shiftRelease.service.js', () => ({
  announceWithdrawal: async () => {},
  releaseUpcomingShifts: async () => {},
}));
vi.mock('../../src/services/subscriptionNumber.service.js', () => ({
  createSubscriptionWithNumber: async () => {},
}));

const { register, resetPassword } = await import('../../src/controllers/auth.controller.js');
const { submitRequest } = await import('../../src/controllers/subscription-requests.controller.js');
const { createSubscription, updateSubscription, recordChequesReceived, updatePayment } =
  await import('../../src/controllers/subscriptions.controller.js');
const { createProducer, updateProducer, createProduct, updateProduct, createBlogPost } =
  await import('../../src/controllers/admin.controller.js');
const { sendContactMessage } = await import('../../src/controllers/contact.controller.js');
const { errorHandler } = await import('../../src/middlewares/error.middleware.js');

const inscription = {
  email: 'awa@exemple.fr',
  firstName: 'Awa',
  lastName: 'Diallo',
  phone: '06 12 34 56 78',
  address: '1 rue des Pois',
};

const contrat = {
  userId: 'adherente-0001',
  type: 'ANNUAL',
  basketSize: 'SMALL',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  pickupLocationId: 'retrait-0001',
};

const premierMessage = (schema, donnees) => schema.safeParse(donnees).error.issues[0].message;

describe('Le refus d\'un formulaire remonte avec son message', () => {
  it.each([
    ['inscription, email', register, { body: { ...inscription, email: 'awa' } }, 'Email invalide'],
    ['inscription, mot de passe', register, { body: { ...inscription, password: 'court' } },
      'Le mot de passe doit contenir au moins 12 caractères'],
    ['réinitialisation', resetPassword, { body: { token: 'a'.repeat(64), password: 'court' } },
      'Le mot de passe doit contenir au moins 12 caractères'],
    ['demande d\'abonnement', submitRequest,
      { user: { id: 'adherente-0001' }, body: { type: 'ANNUAL', basketSize: 'SMALL', pricingType: 'NORMAL', paymentType: '3' } },
      'Modalité de paiement invalide'],
    ['contrat, dates inversées', createSubscription, { body: { ...contrat, endDate: '2026-08-01' } },
      'La date de fin doit être postérieure à la date de début'],
    ['remise des chèques', recordChequesReceived, { params: { id: 'contrat-0001' }, body: { paymentType: '3' } },
      'Modalité de règlement invalide'],
    ['producteur, création', createProducer, { body: { name: '', description: 'Maraîchage', email: 'ferme@exemple.fr' } },
      'Nom requis'],
    ['producteur, code postal', updateProducer, { params: { id: 'producteur-0001' }, body: { postalCode: '7500' } },
      'Code postal : 5 chiffres'],
    ['produit, saisons', createProduct,
      { body: { name: 'Carottes', producerId: 'producteur-0001', seasons: [], basketSizes: ['SMALL'] } },
      'Sélectionnez au moins une saison'],
    ['produit, formats', updateProduct, { params: { id: 'produit-0001' }, body: { basketSizes: [] } },
      'Sélectionnez au moins un format de panier'],
    ['article', createBlogPost, { body: { title: '', content: 'Texte' } }, 'Titre requis'],
    ['contact', sendContactMessage, { body: { name: 'Awa', email: 'awa', subject: 'Panier', message: 'Bonjour' } },
      'Email invalide'],
  ])('%s', async (_cas, controleur, req, attendu) => {
    const { erreur, statut, message } = await appeler(controleur, { params: {}, ...req });

    expect(erreur).toBeInstanceOf(HttpBadRequestError);
    expect(statut).toBe(400);
    expect(message).toBe(attendu);
  });

  it.each([
    ['contrat, prix négatif', updateSubscription, { params: { id: 'contrat-0001' }, body: { price: -5 } }],
    ['paiement, statut inconnu', updatePayment,
      { params: { id: 'contrat-0001', paymentId: 'paiement-0001' }, body: { status: 'PERDU' } }],
  ])('%s, sans message dédié', async (_cas, controleur, req) => {
    const { erreur, statut } = await appeler(controleur, req);

    expect(erreur).toBeInstanceOf(HttpBadRequestError);
    expect(statut).toBe(400);
  });
});

describe('Les champs facultatifs du producteur', () => {
  it.each([
    ['postalCode', '7500', 'Code postal : 5 chiffres'],
    ['farmDetailLabel', 'x'.repeat(41), 'Libellé : 40 caractères maximum'],
    ['farmDetail', 'x'.repeat(201), 'Détail : 200 caractères maximum'],
  ])('%s trop long ou mal formé garde son message', (champ, valeur, attendu) => {
    expect(premierMessage(UpdateProducerSchema, { [champ]: valeur })).toBe(attendu);
  });

  it('gardent la chaîne vide, qui efface le champ en base', () => {
    const { data } = UpdateProducerSchema.safeParse({ city: '', postalCode: '', farmDetailLabel: '', farmDetail: '' });

    expect(data).toEqual({ city: '', postalCode: '', farmDetailLabel: '', farmDetail: '' });
  });

  it('ramènent un nombre laissé vide à undefined, pas à 0', () => {
    const { data } = ProducerSchema.safeParse({
      name: 'Ferme des Pois', description: 'Maraîchage', email: 'ferme@exemple.fr',
      distanceKm: '', partnerSince: '',
    });

    expect(data.distanceKm).toBeUndefined();
    expect(data.partnerSince).toBeUndefined();
  });

  it('convertissent un nombre saisi', () => {
    const { data } = UpdateProducerSchema.safeParse({ distanceKm: '12', partnerSince: '2019', postalCode: '77120' });

    expect(data).toEqual({ distanceKm: 12, partnerSince: 2019, postalCode: '77120' });
  });
});

describe('Les autres schémas partagés', () => {
  it('l\'inscription normalise l\'email avant de le contrôler', () => {
    const { data } = RegisterSchema.safeParse({ ...inscription, email: '  Awa@Exemple.FR ' });

    expect(data.email).toBe('awa@exemple.fr');
  });

  it('la demande d\'abonnement nomme le type refusé', () => {
    expect(premierMessage(SubscriptionRequestSchema, {
      type: 'MENSUEL', basketSize: 'SMALL', pricingType: 'NORMAL', paymentType: '1',
    })).toBe('Type d\'abonnement invalide');
  });
});

describe('Le gestionnaire d\'erreurs', () => {
  it('rend un ZodError levé en 422, avec le détail des refus hors production', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { error } = z.string().safeParse(42);
    const res = reponseFactice();

    errorHandler(error, { path: '/api/essai', method: 'POST' }, res, () => {});

    expect(res.statutHttp).toBe(422);
    expect(res.corps.error.type).toBe('ValidationError');
    expect(res.corps.error.details).toHaveLength(1);
  });
});
