/* Cloison entre deux fermes, par les vrais routeurs et contre la base de test :
   le producteur de la ferme A n'écrit ni sur le produit ni sur l'absence de la
   ferme B. Chaque tentative répond comme un id inexistant, laisse la ligne
   intacte et une ligne FAILED_PRODUCER_SCOPE_CHECK en base. */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';
import authRoutes from '../../src/routes/auth.routes.js';
import producerSpaceRoutes from '../../src/routes/producer-space.routes.js';

const MARQUE = `cloison-${randomUUID()}`;
const MDP = 'Cloison-Producteur-2026!';

let serveur;
let base;
let cookie;
let fermeA;
let fermeB;
let producteurA;
let produitB;
let absenceB;

async function appel(methode, chemin, corps) {
  const res = await fetch(`${base}${chemin}`, {
    method: methode,
    headers: { 'content-type': 'application/json', cookie },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  return { statut: res.status, corps: await res.json() };
}

const refus = (motif, targetId) => prisma.auditLog.findMany({
  where: {
    adminId: producteurA.id,
    action: 'FAILED_PRODUCER_SCOPE_CHECK',
    targetId,
    details: { path: ['motif'], equals: motif },
  },
});

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});

  fermeA = await prisma.producer.create({ data: { name: `Ferme A ${MARQUE}`, email: `${MARQUE}-a@example.invalid` } });
  fermeB = await prisma.producer.create({ data: { name: `Ferme B ${MARQUE}`, email: `${MARQUE}-b@example.invalid` } });
  producteurA = await prisma.user.create({
    data: {
      email: `${MARQUE}-producteur@example.invalid`,
      password: await bcrypt.hash(MDP, 4),
      firstName: 'Cloison',
      lastName: 'Ferme A',
      role: 'PRODUCER',
      producerId: fermeA.id,
      emailVerified: true,
    },
  });
  produitB = await prisma.product.create({
    data: { name: 'Poireaux', producerId: fermeB.id, seasons: ['AUTUMN'], basketSizes: ['SMALL'] },
  });
  absenceB = await prisma.producerAbsence.create({
    data: { producerId: fermeB.id, startDate: new Date('2027-01-04'), endDate: new Date('2027-01-11') },
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/producer', producerSpaceRoutes);
  app.use(errorHandler);
  serveur = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${serveur.address().port}/api`;

  const connexion = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: producteurA.email, password: MDP }),
  });
  cookie = connexion.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('authToken='));
  if (!cookie) throw new Error(`Connexion du producteur impossible (${connexion.status})`);
});

afterAll(async () => {
  if (serveur) await new Promise((resolve) => serveur.close(resolve));

  const fermes = [fermeA?.id, fermeB?.id].filter(Boolean);
  if (producteurA) {
    await prisma.auditLog.deleteMany({ where: { adminId: producteurA.id } });
    await prisma.user.delete({ where: { id: producteurA.id } });
  }
  await prisma.product.deleteMany({ where: { producerId: { in: fermes } } });
  await prisma.producer.deleteMany({ where: { id: { in: fermes } } });
  await prisma.$disconnect();
});

describe('Le producteur de la ferme A écrit sur une ligne de la ferme B', () => {
  const cibles = {
    produit: {
      id: () => produitB.id,
      lire: (id) => prisma.product.findUnique({ where: { id } }),
      motif: 'PRODUIT_AUTRE_FERME',
      type: 'PRODUCT',
    },
    absence: {
      id: () => absenceB.id,
      lire: (id) => prisma.producerAbsence.findUnique({ where: { id } }),
      motif: 'ABSENCE_AUTRE_FERME',
      type: 'PRODUCER_ABSENCE',
    },
  };

  it.each([
    ['modifier le produit', 'produit', 'PUT', '/producer/products/:id', { name: 'Poireaux de A', isActive: false }],
    ['demander sa suppression', 'produit', 'POST', '/producer/products/:id/deletion-request'],
    ['annuler sa demande de suppression', 'produit', 'DELETE', '/producer/products/:id/deletion-request'],
    ['corriger l\'absence', 'absence', 'PUT', '/producer/absences/:id', { reason: 'Vacances' }],
    ['annuler l\'absence', 'absence', 'DELETE', '/producer/absences/:id'],
  ])('%s : 404 identique à un id inexistant, ligne intacte, refus en base', async (_geste, nom, methode, modele, corps) => {
    const cible = cibles[nom];
    const id = cible.id();
    const inexistant = randomUUID();
    const chemin = (valeur) => modele.replace(':id', valeur);

    const avant = await cible.lire(id);
    const tracesAvant = await refus(cible.motif, id);

    const reponse = await appel(methode, chemin(id), corps);
    const reponseInexistant = await appel(methode, chemin(inexistant), corps);

    expect(reponse.statut).toBe(404);
    expect(reponse).toEqual(reponseInexistant);
    expect(await cible.lire(id)).toEqual(avant);

    const traces = await refus(cible.motif, id);
    expect(traces).toHaveLength(tracesAvant.length + 1);
    expect(traces).toContainEqual(expect.objectContaining({
      severity: 'CRITICAL',
      targetType: cible.type,
      details: expect.objectContaining({ method: methode, path: `/api${chemin(id)}` }),
    }));
    expect(await refus(cible.motif, inexistant)).toHaveLength(0);
  });
});

describe('La ferme ne se choisit pas dans le corps de la requête', () => {
  it('un produit envoyé avec le producerId de la ferme B : 400, rien de créé, refus en base', async () => {
    const reponse = await appel('POST', '/producer/products', {
      name: 'Navets',
      producerId: fermeB.id,
      seasons: ['AUTUMN'],
      basketSizes: ['SMALL'],
    });

    expect(reponse.statut).toBe(400);
    expect(await prisma.product.count({ where: { name: 'Navets', producerId: { in: [fermeA.id, fermeB.id] } } })).toBe(0);
    expect(await refus('CHAMP_INTERDIT', fermeA.id)).toContainEqual(expect.objectContaining({
      details: expect.objectContaining({ path: '/api/producer/products', champs: ['producerId'] }),
    }));
  });

  it('une absence envoyée avec le producerId de la ferme B : 400, rien de créé, refus en base', async () => {
    const reponse = await appel('POST', '/producer/absences', {
      producerId: fermeB.id,
      startDate: '2027-02-01',
      endDate: '2027-02-08',
    });

    expect(reponse.statut).toBe(400);
    expect(await prisma.producerAbsence.count({ where: { producerId: fermeA.id } })).toBe(0);
    expect(await prisma.producerAbsence.count({ where: { producerId: fermeB.id } })).toBe(1);
    expect(await refus('CHAMP_INTERDIT', fermeA.id)).toContainEqual(expect.objectContaining({
      details: expect.objectContaining({ path: '/api/producer/absences', champs: ['producerId'] }),
    }));
  });
});
