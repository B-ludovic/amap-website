/* Parcours complet de l'espace producteur, par les vrais routeurs et contre la
   base de test : demande, approbation, fiche, produits, absences, gestes admin,
   révocation, puis journal. Les étapes partagent leur état et s'enchaînent dans
   l'ordre. La cloison entre fermes est couverte par espace-producteur.cloison. */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';
import authRoutes from '../../src/routes/auth.routes.js';
import producersRoutes from '../../src/routes/producers.routes.js';
import adminRoutes from '../../src/routes/admin.routes.js';
import producerAccessRequestsRoutes from '../../src/routes/producer-access-requests.routes.js';
import producerSpaceRoutes from '../../src/routes/producer-space.routes.js';

const MARQUE = `parcours-${randomUUID()}`;
const MDP_MEMBRE = 'Parcours-Membre-2026!';
const MDP_ADMIN = 'Parcours-Admin-2026!';

const sortieAudit = [];
const ids = { users: [], farms: [], products: [] };
let debut;
let serveur;
let base;
let fermeA;
let fermeB;
let fermeC;
let membre;
let admin;
let voisin;
let cookieMembre;
let cookieAdmin;
let cookieProducteur;
let demande;
let carottes;

async function appel(methode, chemin, { cookie, body } = {}) {
  const res = await fetch(`${base}${chemin}`, {
    method: methode,
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  const jeton = res.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('authToken='));
  return { statut: res.status, json, jeton };
}

const connexion = async (email, password) => (await appel('POST', '/auth/login', { body: { email, password } })).jeton;

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    const ligne = args.join(' ');
    if (ligne.startsWith('[Audit]')) sortieAudit.push(ligne);
  });
  debut = new Date();

  const ferme = async (lettre, champs = {}) => {
    const fiche = await prisma.producer.create({
      data: { name: `Parcours Ferme ${lettre}`, email: `${MARQUE}-${lettre}@example.invalid`, description: 'Fiche de parcours', ...champs },
    });
    ids.farms.push(fiche.id);
    return fiche;
  };
  fermeA = await ferme('A');
  fermeB = await ferme('B');
  fermeC = await ferme('C', { isActive: false });

  const compte = async (nom, role, mdp, champs = {}) => {
    const user = await prisma.user.create({
      data: {
        email: `${MARQUE}-${nom}@example.invalid`,
        password: await bcrypt.hash(mdp, 4),
        firstName: 'Parcours',
        lastName: nom,
        role,
        emailVerified: true,
        ...champs,
      },
    });
    ids.users.push(user.id);
    return user;
  };
  membre = await compte('membre', 'MEMBER', MDP_MEMBRE);
  admin = await compte('admin', 'ADMIN', MDP_ADMIN);
  voisin = await compte('voisin', 'PRODUCER', MDP_MEMBRE, { producerId: fermeB.id });

  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/producers', producersRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/producer-access-requests', producerAccessRequestsRoutes);
  app.use('/api/producer', producerSpaceRoutes);
  app.use(errorHandler);
  serveur = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${serveur.address().port}/api`;

  cookieMembre = await connexion(membre.email, MDP_MEMBRE);
  cookieAdmin = await connexion(admin.email, MDP_ADMIN);
  if (!cookieMembre || !cookieAdmin) throw new Error('Connexion du membre ou de l\'admin impossible');
});

afterAll(async () => {
  if (serveur) await new Promise((resolve) => serveur.close(resolve));

  if (debut) {
    await prisma.auditLog.deleteMany({
      where: {
        createdAt: { gte: debut },
        OR: [{ adminId: { in: ids.users } }, { targetId: { in: [...ids.farms, ...ids.products] } }],
      },
    });
  }
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.product.deleteMany({ where: { producerId: { in: ids.farms } } });
  await prisma.producer.deleteMany({ where: { id: { in: ids.farms } } });
  await prisma.$disconnect();
});

describe('Parcours de l\'espace producteur', () => {
  it('un membre vérifié dépose une demande, une seule à la fois, sans accès à l\'espace', async () => {
    let r = await appel('GET', '/producer-access-requests/me', { cookie: cookieMembre });
    expect(r.json.data.request).toBeNull();

    r = await appel('POST', '/producer-access-requests', { cookie: cookieMembre, body: { farmClaim: 'Parcours Ferme A, à Meaux' } });
    expect(r.statut).toBe(201);

    r = await appel('GET', '/producer-access-requests/me', { cookie: cookieMembre });
    expect(r.json.data.request.status).toBe('PENDING');
    expect(JSON.stringify(r.json)).not.toContain('adminNotes');

    r = await appel('POST', '/producer-access-requests', { cookie: cookieMembre, body: { farmClaim: 'Doublon' } });
    expect(r.statut).toBe(409);

    r = await appel('GET', '/producer/farm', { cookie: cookieMembre });
    expect(r.statut).toBe(403);
  });

  it('l\'admin approuve : jamais vers une fiche désactivée, jamais sans son mot de passe', async () => {
    let r = await appel('GET', '/producer-access-requests?status=PENDING', { cookie: cookieAdmin });
    demande = r.json.data.requests.find((d) => d.userId === membre.id);
    expect(demande).toBeDefined();

    r = await appel('POST', `/producer-access-requests/${demande.id}/approve`, { cookie: cookieAdmin, body: { producerId: fermeC.id, password: MDP_ADMIN } });
    expect(r.statut).toBe(409);

    r = await appel('POST', `/producer-access-requests/${demande.id}/approve`, { cookie: cookieAdmin, body: { producerId: fermeA.id, password: 'mauvais' } });
    expect(r.statut).toBe(403);

    r = await appel('POST', `/producer-access-requests/${demande.id}/approve`, { cookie: cookieAdmin, body: { producerId: fermeA.id, adminNotes: 'Vu au marché', password: MDP_ADMIN } });
    expect(r.statut).toBe(200);

    r = await appel('GET', '/auth/me', { cookie: cookieMembre });
    expect(r.statut).toBe(401);

    cookieProducteur = await connexion(membre.email, MDP_MEMBRE);
    r = await appel('GET', '/auth/me', { cookie: cookieProducteur });
    expect(r.json.data.user.role).toBe('PRODUCER');
  });

  it('le producteur tient sa fiche, sans champ réservé ni image en http', async () => {
    let r = await appel('GET', '/producer/farm', { cookie: cookieProducteur });
    expect(r.json.data.producer.id).toBe(fermeA.id);

    r = await appel('PUT', '/producer/farm', { cookie: cookieProducteur, body: { description: 'Maraîchage de parcours', specialty: '', image: 'https://exemple.org/ferme.jpg' } });
    expect(r.statut).toBe(200);
    expect((await prisma.producer.findUnique({ where: { id: fermeA.id } })).specialty).toBeNull();

    r = await appel('PUT', '/producer/farm', { cookie: cookieProducteur, body: { description: 'x', name: 'Pirate' } });
    expect(r.statut).toBe(400);

    r = await appel('PUT', '/producer/farm', { cookie: cookieProducteur, body: { image: 'http://exemple.org/x.jpg' } });
    expect(r.statut).toBe(400);
  });

  it('il crée un produit et en demande la suppression, sans réactivation possible pendant la demande', async () => {
    let r = await appel('POST', '/producer/products', { cookie: cookieProducteur, body: { name: 'carottes', category: 'VEGETABLES', seasons: ['AUTUMN'], basketSizes: ['SMALL', 'LARGE'] } });
    expect(r.statut).toBe(201);
    carottes = r.json.data.product;
    ids.products.push(carottes.id);
    const enBase = await prisma.product.findUnique({ where: { id: carottes.id } });
    expect(enBase.producerId).toBe(fermeA.id);
    expect(enBase.isActive).toBe(true);

    r = await appel('POST', `/producer/products/${carottes.id}/deletion-request`, { cookie: cookieProducteur });
    expect(r.statut).toBe(200);
    expect((await prisma.product.findUnique({ where: { id: carottes.id } })).isActive).toBe(false);

    r = await appel('PUT', `/producer/products/${carottes.id}`, { cookie: cookieProducteur, body: { isActive: true } });
    expect(r.statut).toBe(409);

    r = await appel('PUT', `/admin/products/${carottes.id}`, { cookie: cookieAdmin, body: { isActive: true } });
    expect(r.statut).toBe(409);

    r = await appel('DELETE', `/producer/products/${carottes.id}/deletion-request`, { cookie: cookieProducteur });
    expect(r.statut).toBe(200);
    expect((await prisma.product.findUnique({ where: { id: carottes.id } })).isActive).toBe(false);

    r = await appel('GET', `/producers/${fermeA.id}`);
    expect(r.json.data.producer.products).toHaveLength(0);
  });

  it('il déclare une absence, rattachée à sa ferme', async () => {
    const r = await appel('POST', '/producer/absences', { cookie: cookieProducteur, body: { startDate: '2027-02-01', endDate: '2027-02-07', reason: 'Congés' } });
    expect(r.statut).toBe(201);
    expect(r.json.data.absence.producerId).toBe(fermeA.id);
  });

  it('côté admin : fiche rattachée non désactivable, ferme lisible, rôle producteur jamais attribuable', async () => {
    let r = await appel('PUT', `/admin/producers/${fermeA.id}`, { cookie: cookieAdmin, body: { isActive: false } });
    expect(r.statut).toBe(409);

    r = await appel('GET', '/admin/users?role=PRODUCER&search=parcours', { cookie: cookieAdmin });
    expect(r.json.data.users.find((u) => u.id === voisin.id)?.producer?.name).toBe('Parcours Ferme B');

    r = await appel('GET', '/admin/users?role=CUSTOMER', { cookie: cookieAdmin });
    expect(r.statut).toBe(400);

    r = await appel('PUT', `/admin/users/${membre.id}/role`, { cookie: cookieAdmin, body: { role: 'ADMIN', password: MDP_ADMIN } });
    expect(r.statut).toBe(409);
  });

  it('la révocation rend le rôle, coupe la session et fixe la nouvelle demande à trente jours', async () => {
    let r = await appel('POST', `/producer-access-requests/${demande.id}/revoke`, { cookie: cookieAdmin, body: { password: MDP_ADMIN } });
    expect(r.statut).toBe(200);
    const apres = await prisma.user.findUnique({ where: { id: membre.id } });
    expect(apres.role).toBe('MEMBER');
    expect(apres.producerId).toBeNull();

    r = await appel('GET', '/producer/farm', { cookie: cookieProducteur });
    expect(r.statut).toBe(401);

    const cookieApres = await connexion(membre.email, MDP_MEMBRE);
    r = await appel('GET', '/producer-access-requests/me', { cookie: cookieApres });
    const jours = Math.round((new Date(r.json.data.request.nextRequestAt) - Date.now()) / 86_400_000);
    expect(jours).toBe(30);
  });

  it('chaque geste laisse sa ligne en base, et la sortie [Audit] ne porte aucune adresse', async () => {
    const journal = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: debut },
        OR: [{ adminId: { in: ids.users } }, { targetId: { in: [...ids.farms, ...ids.products] } }],
      },
      select: { action: true, details: true },
    });
    const actions = new Set(journal.map((ligne) => ligne.action));

    for (const action of [
      'CREATE_PRODUCER_ACCESS_REQUEST', 'FAILED_PRODUCER_ACCESS_REQUEST', 'FAILED_PRODUCER_SCOPE_CHECK',
      'FAILED_PRODUCER_ACCESS_APPROVAL', 'FAILED_ACCOUNT_REAUTH', 'APPROVE_PRODUCER_ACCESS_REQUEST',
      'UPDATE_PRODUCER', 'CREATE_PRODUCT', 'REQUEST_PRODUCT_DELETION', 'UPDATE_PRODUCT', 'REVOKE_PRODUCER_ACCESS',
    ]) {
      expect(actions, action).toContain(action);
    }

    const motifs = journal
      .filter((ligne) => ligne.action === 'FAILED_PRODUCER_SCOPE_CHECK')
      .map((ligne) => ligne.details?.motif)
      .sort();
    expect(motifs).toEqual(['CHAMP_INTERDIT', 'ROLE_NON_PRODUCTEUR']);

    expect(sortieAudit.length).toBeGreaterThan(0);
    expect(sortieAudit.filter((ligne) => ligne.includes('@'))).toEqual([]);
  });
});
