/* Le formulaire public « Devenir producteur » : chaque champ est contrôlé en
   type et en longueur avant d'atteindre la base, et un refus sort en 400. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';
import { HttpBadRequestError } from '../../src/utils/httpErrors.js';

const { ecrits } = vi.hoisted(() => ({ ecrits: [] }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    producerInquiry: {
      create: async ({ data }) => {
        ecrits.push(data);
        return { id: 'candidature-de-test-0001', ...data };
      },
    },
  },
}));
vi.mock('../../src/services/email.service.js', () => ({
  default: { sendProducerInquiryConfirmation: async () => ({ success: true }) },
}));
vi.mock('../../src/services/audit.service.js', () => ({ logAudit: async () => {} }));

const { submitInquiry } = await import('../../src/controllers/producer-inquiries.controller.js');

// La forme exacte de ce qu'envoie la page devenir-producteur.
const candidature = {
  firstName: 'nadia',
  lastName: 'benali',
  email: 'nadia@example.net',
  phone: '06 12 34 56 78',
  farmName: 'ferme des trois chênes',
  address: '4 chemin des Prés',
  city: 'milly-la-forêt',
  postalCode: '91490',
  distance: 45,
  products: 'Légumes de saison, œufs',
  isBio: false,
  certifications: null,
  message: null,
  availability: null,
};

const soumettre = (body) => appeler(submitInquiry, { body });

beforeEach(() => {
  ecrits.length = 0;
});

describe('Une candidature conforme', () => {
  it('est enregistrée, noms normalisés et champs vides laissés de côté', async () => {
    const { statut } = await soumettre(candidature);

    expect(statut).toBe(201);
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]).toMatchObject({ firstName: 'Nadia', distance: 45, isBio: false });
    expect(ecrits[0].certifications).toBeUndefined();
    expect(ecrits[0].message).toBeUndefined();
  });

  it('convertit une distance saisie en texte', async () => {
    await soumettre({ ...candidature, distance: '12' });

    expect(ecrits[0].distance).toBe(12);
  });

  it('n\'écrit aucun champ hors formulaire', async () => {
    await soumettre({ ...candidature, status: 'ACCEPTED', adminNotes: 'validé' });

    expect(ecrits[0]).not.toHaveProperty('status');
    expect(ecrits[0]).not.toHaveProperty('adminNotes');
  });
});

describe('Une candidature refusée n\'atteint pas la base', () => {
  it.each([
    ['produits démesurés', { products: 'x'.repeat(90_000) }, 'Produits : 2000 caractères maximum'],
    ['certifications démesurées', { certifications: 'x'.repeat(501) }, 'Certifications : 500 caractères maximum'],
    ['disponibilités démesurées', { availability: 'x'.repeat(501) }, 'Disponibilités : 500 caractères maximum'],
    ['prénom numérique', { firstName: 42 }, 'Prénom requis'],
    ['prénom fait d\'espaces', { firstName: '   ' }, 'Prénom requis'],
    ['téléphone en lettres', { phone: 'appelez-moi' }, 'Téléphone invalide'],
    ['téléphone démesuré', { phone: '0'.repeat(31) }, 'Téléphone : 30 caractères maximum'],
    ['distance non numérique', { distance: 'abc' }, 'Distance invalide'],
    ['distance hors bornes', { distance: 301 }, 'Distance : 300 km maximum'],
    ['case bio en texte', { isBio: 'oui' }, 'Case « bio » invalide'],
    ['produits absents', { products: undefined }, 'Types de produits requis'],
  ])('%s', async (_cas, champs, attendu) => {
    const { erreur, statut, message } = await soumettre({ ...candidature, ...champs });

    expect(erreur).toBeInstanceOf(HttpBadRequestError);
    expect(statut).toBe(400);
    expect(message).toBe(attendu);
    expect(ecrits).toHaveLength(0);
  });

  it('refuse un corps qui n\'est pas un objet', async () => {
    const { statut, message } = await soumettre([candidature]);

    expect(statut).toBe(400);
    expect(message).toBe('Formulaire invalide');
  });
});
