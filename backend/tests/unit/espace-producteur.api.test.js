/* L'API de l'espace producteur : sa fiche, ses produits, ses absences. La ferme
   vient du compte ; un champ qui ne lui revient pas ou la ressource d'une autre
   ferme sont refusés et consignés. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appeler } from '../helpers/expressFactice.js';

const { base, journal, verrous } = vi.hoisted(() => ({
  base: { fiches: [], produits: [], absences: [], suivant: 1 },
  journal: [],
  verrous: [],
}));

vi.mock('../../src/services/audit.service.js', () => ({
  logAudit: async (_req, action, severite, cible, details, code) => {
    journal.push({ action, severite, cible, details, code });
  },
}));

const ficheDe = (id) => base.fiches.find((f) => f.id === id);
const produitDe = (id) => base.produits.find((p) => p.id === id);
const absenceDe = (id) => base.absences.find((a) => a.id === id);
const avecFerme = (absence) => ({ ...absence, producer: { id: absence.producerId, name: ficheDe(absence.producerId)?.name } });

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    $transaction: async (travail) => travail(prisma),
    $queryRaw: async (morceaux, ...valeurs) => {
      verrous.push({ table: morceaux.join('?').match(/FROM "(\w+)"/)[1], id: valeurs[0] });
      return [];
    },
    producer: {
      findUnique: async ({ where }) => (ficheDe(where.id) ? { ...ficheDe(where.id) } : null),
      update: async ({ where, data }) => ({ ...Object.assign(ficheDe(where.id), data) }),
    },
    product: {
      findMany: async ({ where }) => base.produits
        .filter((p) => p.producerId === where.producerId && p.deletedAt === null)
        .map((p) => ({ ...p })),
      findFirst: async ({ where }) => base.produits.find((p) => p.name === where.name && p.producerId === where.producerId) ?? null,
      findUnique: async ({ where }) => (produitDe(where.id) ? { ...produitDe(where.id) } : null),
      create: async ({ data }) => {
        const produit = { id: `produit-${base.suivant++}`, deletionRequestedAt: null, deletedAt: null, isExample: false, ...data };
        base.produits.push(produit);
        return { ...produit };
      },
      update: async ({ where, data }) => ({ ...Object.assign(produitDe(where.id), data) }),
    },
    producerAbsence: {
      findMany: async ({ where }) => base.absences.filter((a) => a.producerId === where.producerId).map(avecFerme),
      findUnique: async ({ where }) => (absenceDe(where.id) ? avecFerme(absenceDe(where.id)) : null),
      create: async ({ data }) => {
        const absence = { id: `absence-${base.suivant++}`, ...data };
        base.absences.push(absence);
        return avecFerme(absence);
      },
      update: async ({ where, data }) => {
        const absence = absenceDe(where.id);
        if (!absence || absence.producerId !== where.producerId) throw new Error('P2025');
        return avecFerme(Object.assign(absence, data));
      },
      delete: async ({ where }) => {
        const absence = absenceDe(where.id);
        if (!absence || absence.producerId !== where.producerId) throw new Error('P2025');
        base.absences = base.absences.filter((a) => a.id !== where.id);
        return absence;
      },
    },
  };

  return { prisma };
});

const espace = await import('../../src/controllers/producer-space.controller.js');
const { default: routeur } = await import('../../src/routes/producer-space.routes.js');
const { authMiddleware } = await import('../../src/middlewares/auth.middleware.js');
const { producerOnly } = await import('../../src/middlewares/role.middleware.js');

const producteur = { id: 'user-0001', email: 'paul@example.org', role: 'PRODUCER', producerId: 'ferme-0001' };

const appel = (controleur, { body, params = {}, method = 'PUT', path = '/api/producer/x' } = {}) => appeler(controleur, {
  user: producteur,
  producerId: producteur.producerId,
  body,
  params,
  method,
  originalUrl: `${path}?trace=1`,
  ip: '203.0.113.10',
});

const refusPortee = (cible, motif, method, path, extra = {}) => ({
  action: 'FAILED_PRODUCER_SCOPE_CHECK',
  severite: 'CRITICAL',
  cible,
  details: { motif, method, path, ...extra },
  code: motif,
});

const produit = (champs) => ({
  name: 'Carottes',
  category: 'VEGETABLES',
  description: null,
  isActive: true,
  isExample: false,
  seasons: ['AUTUMN'],
  basketSizes: ['SMALL', 'LARGE'],
  deletionRequestedAt: null,
  deletedAt: null,
  ...champs,
});

beforeEach(() => {
  base.fiches = [
    { id: 'ferme-0001', name: 'La Ferme des Lilas', email: 'lilas@example.org', description: 'Maraîchage', isActive: true, isExample: false, city: 'Meaux', image: null, phone: null },
    { id: 'ferme-0002', name: 'Le Verger du Coteau', email: 'coteau@example.org', description: 'Pommes', isActive: true, isExample: false },
  ];
  base.produits = [
    produit({ id: 'produit-a', producerId: 'ferme-0001' }),
    produit({ id: 'produit-b', producerId: 'ferme-0002', name: 'Pommes' }),
    produit({ id: 'produit-retire', producerId: 'ferme-0001', name: 'Navets', deletedAt: new Date('2026-01-01') }),
  ];
  base.absences = [
    { id: 'absence-a', producerId: 'ferme-0001', startDate: new Date('2026-12-21'), endDate: new Date('2026-12-28'), reason: null },
    { id: 'absence-b', producerId: 'ferme-0002', startDate: new Date('2026-12-21'), endDate: new Date('2026-12-28'), reason: 'Congés' },
  ];
  base.suivant = 1;
  journal.length = 0;
  verrous.length = 0;
});

describe('Routeur de l\'espace producteur', () => {
  it('fait passer chaque route par authMiddleware puis producerOnly', () => {
    const rang = (fn) => routeur.stack.findIndex((couche) => couche.handle === fn);
    const routes = routeur.stack.filter((couche) => couche.route);

    expect(rang(authMiddleware)).toBe(0);
    expect(rang(producerOnly)).toBe(1);
    expect(routes.map((couche) => `${Object.keys(couche.route.methods)[0].toUpperCase()} ${couche.route.path}`)).toEqual([
      'GET /farm',
      'PUT /farm',
      'GET /products',
      'POST /products',
      'PUT /products/:id',
      'POST /products/:id/deletion-request',
      'DELETE /products/:id/deletion-request',
      'GET /absences',
      'POST /absences',
      'PUT /absences/:id',
      'DELETE /absences/:id',
    ]);
  });
});

describe('Fiche de la ferme', () => {
  it('lit la fiche du compte', async () => {
    const { statut, corps } = await appel(espace.getOwnFarm, { method: 'GET' });

    expect(statut).toBe(200);
    expect(corps.data.producer.id).toBe('ferme-0001');
  });

  it('écrit les champs du producteur, vide en null, et le consigne', async () => {
    const { statut } = await appel(espace.updateOwnFarm, {
      body: { description: 'Légumes de plein champ', specialty: '', phone: '01 23 45 67 89', image: 'https://exemple.org/ferme.jpg' },
    });

    expect(statut).toBe(200);
    expect(ficheDe('ferme-0001')).toMatchObject({
      description: 'Légumes de plein champ',
      specialty: null,
      phone: '01 23 45 67 89',
      image: 'https://exemple.org/ferme.jpg',
    });
    expect(journal).toEqual([{
      action: 'UPDATE_PRODUCER',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCER', id: 'ferme-0001', label: 'La Ferme des Lilas' },
      details: { champs: ['description', 'specialty', 'phone', 'image'] },
      code: undefined,
    }]);
  });

  it.each([
    ['name', 'Ferme pirate'],
    ['email', 'pirate@example.org'],
    ['isActive', false],
    ['isExample', true],
    ['city', 'Ailleurs'],
    ['certification', 'ORGANIC'],
    ['partnerSince', 1990],
    ['id', 'ferme-0002'],
  ])('refuse le champ %s, n\'écrit rien, et le consigne', async (champ, valeur) => {
    const avant = { ...ficheDe('ferme-0001') };
    const { statut } = await appel(espace.updateOwnFarm, { body: { description: 'Nouveau', [champ]: valeur }, path: '/api/producer/farm' });

    expect(statut).toBe(400);
    expect(ficheDe('ferme-0001')).toEqual(avant);
    expect(journal).toEqual([refusPortee({ type: 'PRODUCER', id: 'ferme-0001' }, 'CHAMP_INTERDIT', 'PUT', '/api/producer/farm', { champs: [champ] })]);
  });

  it.each([
    ['une adresse http', 'http://exemple.org/ferme.jpg'],
    ['un script', 'javascript:alert(1)'],
    ['un texte', 'ma photo'],
    ['plus de 500 caractères', `https://exemple.org/${'a'.repeat(490)}`],
  ])('refuse une image qui est %s', async (_cas, image) => {
    const { statut } = await appel(espace.updateOwnFarm, { body: { image } });

    expect(statut).toBe(400);
    expect(ficheDe('ferme-0001').image).toBeNull();
    expect(journal).toHaveLength(0);
  });

  it('refuse une description vide', async () => {
    const { statut } = await appel(espace.updateOwnFarm, { body: { description: '  ' } });

    expect(statut).toBe(400);
    expect(ficheDe('ferme-0001').description).toBe('Maraîchage');
  });

  it('refuse un corps qui n\'est pas un objet, sans le consigner', async () => {
    const { statut } = await appel(espace.updateOwnFarm, { body: ['description'] });

    expect(statut).toBe(400);
    expect(journal).toHaveLength(0);
  });
});

describe('Produits de la ferme', () => {
  it('liste les seuls produits de la ferme, retirés exclus', async () => {
    const { corps } = await appel(espace.getOwnProducts, { method: 'GET' });

    expect(corps.data.products.map((p) => p.id)).toEqual(['produit-a']);
  });

  it('crée un produit actif par défaut, rattaché à la ferme du compte, et le consigne', async () => {
    const { statut, corps } = await appel(espace.createOwnProduct, {
      method: 'POST',
      body: { name: 'poireaux', seasons: ['WINTER'], basketSizes: ['LARGE'] },
    });

    expect(statut).toBe(201);
    expect(produitDe(corps.data.product.id)).toMatchObject({
      name: 'Poireaux',
      producerId: 'ferme-0001',
      isActive: true,
      isExample: false,
      category: null,
    });
    expect(journal).toEqual([{
      action: 'CREATE_PRODUCT',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCT', id: corps.data.product.id, label: 'Poireaux' },
      details: undefined,
      code: undefined,
    }]);
  });

  it('respecte la case décochée à la création', async () => {
    const { corps } = await appel(espace.createOwnProduct, {
      method: 'POST',
      body: { name: 'Courges', isActive: false, seasons: ['AUTUMN'], basketSizes: ['SMALL'] },
    });

    expect(produitDe(corps.data.product.id).isActive).toBe(false);
  });

  it.each([
    ['producerId', 'ferme-0002'],
    ['isExample', true],
    ['image', 'https://exemple.org/p.jpg'],
    ['deletionRequestedAt', null],
  ])('refuse le champ %s à la création, et le consigne', async (champ, valeur) => {
    const { statut } = await appel(espace.createOwnProduct, {
      method: 'POST',
      path: '/api/producer/products',
      body: { name: 'Poireaux', seasons: ['WINTER'], basketSizes: ['LARGE'], [champ]: valeur },
    });

    expect(statut).toBe(400);
    expect(base.produits).toHaveLength(3);
    expect(journal).toEqual([refusPortee({ type: 'PRODUCER', id: 'ferme-0001' }, 'CHAMP_INTERDIT', 'POST', '/api/producer/products', { champs: [champ] })]);
  });

  it('refuse un doublon dans le catalogue de la ferme', async () => {
    const { statut } = await appel(espace.createOwnProduct, {
      method: 'POST',
      body: { name: 'carottes', seasons: ['AUTUMN'], basketSizes: ['SMALL'] },
    });

    expect(statut).toBe(400);
    expect(base.produits).toHaveLength(3);
  });

  it('accepte un nom déjà pris par une autre ferme', async () => {
    const { statut } = await appel(espace.createOwnProduct, {
      method: 'POST',
      body: { name: 'Pommes', seasons: ['AUTUMN'], basketSizes: ['SMALL'] },
    });

    expect(statut).toBe(201);
  });

  it('refuse une catégorie inconnue', async () => {
    const { statut } = await appel(espace.createOwnProduct, {
      method: 'POST',
      body: { name: 'Miel', category: 'HONEY', seasons: ['SUMMER'], basketSizes: ['SMALL'] },
    });

    expect(statut).toBe(400);
  });

  it('modifie son produit sous verrou, et le consigne', async () => {
    const { statut } = await appel(espace.updateOwnProduct, {
      params: { id: 'produit-a' },
      body: { isActive: false, description: '' },
    });

    expect(statut).toBe(200);
    expect(produitDe('produit-a')).toMatchObject({ isActive: false, description: null, producerId: 'ferme-0001' });
    expect(verrous).toEqual([{ table: 'Product', id: 'produit-a' }]);
    expect(journal).toEqual([{
      action: 'UPDATE_PRODUCT',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCT', id: 'produit-a', label: 'Carottes' },
      details: { before: { name: 'Carottes', isActive: true }, after: { name: 'Carottes', isActive: false } },
      code: undefined,
    }]);
  });

  it('refuse le produit d\'une autre ferme comme un produit inexistant, et le consigne', async () => {
    const avant = { ...produitDe('produit-b') };
    const autre = await appel(espace.updateOwnProduct, {
      params: { id: 'produit-b' },
      path: '/api/producer/products/produit-b',
      body: { name: 'Pommes volées' },
    });
    const journalAutre = [...journal];
    journal.length = 0;
    const inexistant = await appel(espace.updateOwnProduct, { params: { id: 'produit-z' }, body: { name: 'Rien' } });

    expect(autre.statut).toBe(404);
    expect(autre.message).toBe(inexistant.message);
    expect(inexistant.statut).toBe(404);
    expect(produitDe('produit-b')).toEqual(avant);
    expect(journalAutre).toEqual([refusPortee({ type: 'PRODUCT', id: 'produit-b' }, 'PRODUIT_AUTRE_FERME', 'PUT', '/api/producer/products/produit-b')]);
    expect(journal).toHaveLength(0);
  });

  it('traite un produit retiré comme introuvable', async () => {
    const { statut } = await appel(espace.updateOwnProduct, { params: { id: 'produit-retire' }, body: { isActive: true } });

    expect(statut).toBe(404);
    expect(journal).toHaveLength(0);
  });

  it.each([
    ['producerId', 'ferme-0002'],
    ['isExample', true],
    ['deletionRequestedAt', null],
  ])('refuse le champ %s en modification, et le consigne', async (champ, valeur) => {
    const { statut } = await appel(espace.updateOwnProduct, {
      params: { id: 'produit-a' },
      path: '/api/producer/products/produit-a',
      body: { [champ]: valeur },
    });

    expect(statut).toBe(400);
    expect(produitDe('produit-a')).toMatchObject({ producerId: 'ferme-0001', isExample: false, deletionRequestedAt: null });
    expect(journal).toEqual([refusPortee({ type: 'PRODUCT', id: 'produit-a' }, 'CHAMP_INTERDIT', 'PUT', '/api/producer/products/produit-a', { champs: [champ] })]);
  });
});

describe('Demande de suppression d\'un produit', () => {
  it('sort le produit du tirage dans la même écriture, et le consigne', async () => {
    const { statut } = await appel(espace.requestProductDeletion, { method: 'POST', params: { id: 'produit-a' } });

    expect(statut).toBe(200);
    expect(produitDe('produit-a')).toMatchObject({ isActive: false, deletionRequestedAt: expect.any(Date) });
    expect(verrous).toEqual([{ table: 'Product', id: 'produit-a' }]);
    expect(journal).toEqual([{
      action: 'REQUEST_PRODUCT_DELETION',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCT', id: 'produit-a', label: 'Carottes' },
      details: { wasActive: true },
      code: undefined,
    }]);
  });

  it('refuse une seconde demande', async () => {
    produitDe('produit-a').deletionRequestedAt = new Date('2026-11-01');
    const { statut } = await appel(espace.requestProductDeletion, { method: 'POST', params: { id: 'produit-a' } });

    expect(statut).toBe(409);
    expect(produitDe('produit-a').deletionRequestedAt).toEqual(new Date('2026-11-01'));
  });

  it('refuse la demande sur le produit d\'une autre ferme, et le consigne', async () => {
    const { statut } = await appel(espace.requestProductDeletion, {
      method: 'POST',
      params: { id: 'produit-b' },
      path: '/api/producer/products/produit-b/deletion-request',
    });

    expect(statut).toBe(404);
    expect(produitDe('produit-b')).toMatchObject({ isActive: true, deletionRequestedAt: null });
    expect(journal).toEqual([refusPortee({ type: 'PRODUCT', id: 'produit-b' }, 'PRODUIT_AUTRE_FERME', 'POST', '/api/producer/products/produit-b/deletion-request')]);
  });

  it('refuse la réactivation tant que la demande court', async () => {
    Object.assign(produitDe('produit-a'), { isActive: false, deletionRequestedAt: new Date('2026-11-01') });
    const { statut } = await appel(espace.updateOwnProduct, { params: { id: 'produit-a' }, body: { isActive: true } });

    expect(statut).toBe(409);
    expect(produitDe('produit-a').isActive).toBe(false);
    expect(journal).toHaveLength(0);
  });

  it('laisse modifier le reste du produit pendant la demande', async () => {
    Object.assign(produitDe('produit-a'), { isActive: false, deletionRequestedAt: new Date('2026-11-01') });
    const { statut } = await appel(espace.updateOwnProduct, { params: { id: 'produit-a' }, body: { description: 'Fin de saison' } });

    expect(statut).toBe(200);
    expect(produitDe('produit-a')).toMatchObject({ description: 'Fin de saison', isActive: false });
  });

  it('annule la demande sans réactiver le produit, et le consigne', async () => {
    Object.assign(produitDe('produit-a'), { isActive: false, deletionRequestedAt: new Date('2026-11-01') });
    const { statut } = await appel(espace.cancelProductDeletion, { method: 'DELETE', params: { id: 'produit-a' } });

    expect(statut).toBe(200);
    expect(produitDe('produit-a')).toMatchObject({ isActive: false, deletionRequestedAt: null });
    expect(journal).toEqual([{
      action: 'UPDATE_PRODUCT',
      severite: 'IMPORTANT',
      cible: { type: 'PRODUCT', id: 'produit-a', label: 'Carottes' },
      details: { geste: 'ANNULATION_DEMANDE_SUPPRESSION' },
      code: undefined,
    }]);
  });

  it('refuse d\'annuler une demande qui n\'existe pas', async () => {
    const { statut } = await appel(espace.cancelProductDeletion, { method: 'DELETE', params: { id: 'produit-a' } });

    expect(statut).toBe(409);
  });

  it('refuse l\'annulation sur le produit d\'une autre ferme, et le consigne', async () => {
    produitDe('produit-b').deletionRequestedAt = new Date('2026-11-01');
    const { statut } = await appel(espace.cancelProductDeletion, {
      method: 'DELETE',
      params: { id: 'produit-b' },
      path: '/api/producer/products/produit-b/deletion-request',
    });

    expect(statut).toBe(404);
    expect(produitDe('produit-b').deletionRequestedAt).toEqual(new Date('2026-11-01'));
    expect(journal).toEqual([refusPortee({ type: 'PRODUCT', id: 'produit-b' }, 'PRODUIT_AUTRE_FERME', 'DELETE', '/api/producer/products/produit-b/deletion-request')]);
  });
});

describe('Absences de la ferme', () => {
  it('liste les seules absences de la ferme', async () => {
    const { corps } = await appel(espace.getOwnAbsences, { method: 'GET' });

    expect(corps.data.absences.map((a) => a.id)).toEqual(['absence-a']);
  });

  it('déclare une absence pour la ferme du compte, et le consigne', async () => {
    const { statut, corps } = await appel(espace.createOwnAbsence, {
      method: 'POST',
      body: { startDate: '2027-01-04', endDate: '2027-01-11', reason: 'Congés' },
    });

    expect(statut).toBe(201);
    expect(absenceDe(corps.data.absence.id)).toMatchObject({ producerId: 'ferme-0001', reason: 'Congés' });
    expect(journal).toEqual([expect.objectContaining({
      action: 'UPDATE_PRODUCER',
      severite: 'IMPORTANT',
      cible: expect.objectContaining({ type: 'PRODUCER', id: 'ferme-0001' }),
    })]);
  });

  it('refuse un producerId dans le corps, et le consigne', async () => {
    const { statut } = await appel(espace.createOwnAbsence, {
      method: 'POST',
      path: '/api/producer/absences',
      body: { producerId: 'ferme-0002', startDate: '2027-01-04', endDate: '2027-01-11' },
    });

    expect(statut).toBe(400);
    expect(base.absences).toHaveLength(2);
    expect(journal).toEqual([refusPortee({ type: 'PRODUCER', id: 'ferme-0001' }, 'CHAMP_INTERDIT', 'POST', '/api/producer/absences', { champs: ['producerId'] })]);
  });

  it('refuse une période à l\'envers', async () => {
    const { statut } = await appel(espace.createOwnAbsence, {
      method: 'POST',
      body: { startDate: '2027-01-11', endDate: '2027-01-04' },
    });

    expect(statut).toBe(400);
    expect(base.absences).toHaveLength(2);
  });

  it('corrige son absence', async () => {
    const { statut } = await appel(espace.updateOwnAbsence, { params: { id: 'absence-a' }, body: { reason: 'Récolte perdue' } });

    expect(statut).toBe(200);
    expect(absenceDe('absence-a').reason).toBe('Récolte perdue');
  });

  it('annule son absence', async () => {
    const { statut } = await appel(espace.deleteOwnAbsence, { method: 'DELETE', params: { id: 'absence-a' } });

    expect(statut).toBe(200);
    expect(absenceDe('absence-a')).toBeUndefined();
  });

  it.each([
    ['corriger', 'updateOwnAbsence', 'PUT', { reason: 'Piraté' }],
    ['annuler', 'deleteOwnAbsence', 'DELETE', undefined],
  ])('refuse de %s l\'absence d\'une autre ferme comme une absence inexistante, et le consigne', async (_geste, controleur, method, body) => {
    const avant = { ...absenceDe('absence-b') };
    const autre = await appel(espace[controleur], { method, body, params: { id: 'absence-b' }, path: '/api/producer/absences/absence-b' });
    const journalAutre = [...journal];
    journal.length = 0;
    const inexistante = await appel(espace[controleur], { method, body, params: { id: 'absence-z' } });

    expect(autre.statut).toBe(404);
    expect(autre.message).toBe(inexistante.message);
    expect(absenceDe('absence-b')).toEqual(avant);
    expect(journalAutre).toEqual([refusPortee({ type: 'PRODUCER_ABSENCE', id: 'absence-b' }, 'ABSENCE_AUTRE_FERME', method, '/api/producer/absences/absence-b')]);
    expect(journal).toHaveLength(0);
  });
});
