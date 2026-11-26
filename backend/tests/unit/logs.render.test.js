/* Ce que Render affiche : la seule sortie standard du serveur. Une action
   sensible, réussie ou refusée, doit y laisser une ligne, sans donnée
   personnelle. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { reponseFactice } from '../helpers/expressFactice.js';

const { base } = vi.hoisted(() => ({ base: { journal: [], panne: null } }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    auditLog: {
      create: async ({ data }) => {
        if (base.panne) throw base.panne;
        base.journal.push(data);
        return data;
      },
    },
  },
}));

const { logAudit } = await import('../../src/services/audit.service.js');
const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
const { limiteur } = await import('../../src/middlewares/rateLimit.middleware.js');
const { HttpUnauthorizedError, HttpForbiddenError } = await import('../../src/utils/httpErrors.js');

const admin = { id: 'admin-0001', email: 'bureau@auxptitspois.test' };

let log;
let warn;
let error;

beforeEach(() => {
  base.journal = [];
  base.panne = null;
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

const lignes = (espion) => espion.mock.calls.map((args) => args.map(String).join(' '));

describe('Journal d\'audit sur la console', () => {
  it('écrit l\'action, la sévérité, l\'acteur et la cible', async () => {
    await logAudit({ user: admin, ip: '203.0.113.7' }, 'CHANGE_USER_ROLE', 'CRITICAL',
      { type: 'USER', id: 'user-0042', label: 'adherente@exemple.test' },
      { oldRole: 'MEMBER', newRole: 'ADMIN' });

    expect(lignes(log)).toEqual(['[Audit] CRITICAL CHANGE_USER_ROLE par admin-0001 sur USER user-0042']);
    expect(base.journal).toHaveLength(1);
  });

  it('laisse en base l\'email, le libellé et les détails', async () => {
    await logAudit({ user: admin, ip: '203.0.113.7' }, 'DELETE_USER', 'CRITICAL',
      { type: 'USER', id: 'user-0042', label: 'adherente@exemple.test' },
      { motif: 'Marie Dupont' });

    const ligne = lignes(log).join('\n');
    expect(ligne).not.toContain('bureau@');
    expect(ligne).not.toContain('adherente@');
    expect(ligne).not.toContain('Dupont');
    expect(ligne).not.toContain('203.0.113.7');
    expect(base.journal[0]).toMatchObject({ adminEmail: admin.email, targetLabel: 'adherente@exemple.test' });
  });

  it('attribue au système un passage de job, sans requête', async () => {
    await logAudit(null, 'PURGE_USER_DATA', 'IMPORTANT', { type: 'USER', label: 'Comptes non vérifiés' }, { count: 3 });

    expect(lignes(log)).toEqual(['[Audit] IMPORTANT PURGE_USER_DATA par système sur USER']);
  });

  it('reste visible quand la base refuse l\'écriture, sans faire échouer l\'action', async () => {
    base.panne = new Error('connexion perdue');

    await expect(logAudit({ user: admin }, 'UPDATE_PAYMENT_STATUS', 'CRITICAL', { type: 'SUBSCRIPTION', id: 'sub-7' }))
      .resolves.toBeUndefined();

    expect(lignes(log)).toEqual(['[Audit] CRITICAL UPDATE_PAYMENT_STATUS par admin-0001 sur SUBSCRIPTION sub-7']);
    expect(lignes(error)[0]).toContain('[AuditLog]');
  });

  it('ne fait pas échouer l\'action quand la cible est nulle', async () => {
    await expect(logAudit({ user: admin }, 'DELETE_EXAMPLES', 'IMPORTANT', null)).resolves.toBeUndefined();

    expect(lignes(log)).toEqual(['[Audit] IMPORTANT DELETE_EXAMPLES par admin-0001']);
  });
});

const erreurPrisma = (name, code) => Object.assign(new Error('Invalid `prisma.user.create()` invocation'), { name, code });

const zodError = () => {
  try {
    z.object({ email: z.string() }).parse({ email: 42 });
  } catch (err) {
    return err;
  }
};

describe('Erreurs capturées', () => {
  const capturer = (err, req) => {
    const res = reponseFactice();
    errorHandler(err, { path: '/api/essai', method: 'POST', ...req }, res, () => {});
    const appel = error.mock.calls.find(([intitule]) => intitule === 'Erreur capturée:');
    return { res, journal: appel?.[1] };
  };

  it.each([
    ['une connexion refusée', new HttpUnauthorizedError('Email ou mot de passe incorrect.'), 401],
    ['un droit manquant', new HttpForbiddenError(), 403],
    ['une validation zod', zodError(), 422],
    ['un refus de la base', erreurPrisma('PrismaClientKnownRequestError', 'P2002'), 400],
    ['une requête Prisma malformée', erreurPrisma('PrismaClientValidationError'), 500],
    ['un code d\'erreur numérique', Object.assign(new Error('ENOENT'), { code: -2 }), 500],
    ['une panne imprévue', new Error('boum'), 500],
  ])('journalise %s avec le statut réellement renvoyé', (_cas, err, statut) => {
    const { res, journal } = capturer(err);

    expect(journal.status).toBe(statut);
    expect(res.statutHttp).toBe(statut);
  });

  it('nomme l\'utilisateur connecté, et personne avant l\'authentification', () => {
    expect(capturer(new HttpForbiddenError(), { user: admin }).journal.user).toBe('admin-0001');

    error.mockClear();
    expect(capturer(new HttpUnauthorizedError()).journal.user).toBeNull();
  });

  it('ne recopie pas l\'email de l\'utilisateur', () => {
    capturer(new HttpForbiddenError(), { user: admin });

    expect(JSON.stringify(error.mock.calls)).not.toContain(admin.email);
  });
});

describe('Limiteurs de débit', () => {
  const message = { success: false, error: { message: 'Trop de tentatives.' } };

  const fabriquer = (nom) => limiteur(nom, {
    windowMs: 60 * 1000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    message,
  });

  const frapper = async (middleware, { ip = '203.0.113.7', url = '/api/auth/login' } = {}) => {
    const req = { ip, method: 'POST', originalUrl: url, headers: {}, app: { get: () => 1 } };
    const res = {
      ...reponseFactice(),
      entetes: {},
      headersSent: false,
      writableEnded: false,
      setHeader(nom, valeur) { this.entetes[nom] = valeur; },
      send(payload) { this.corps = payload; return this; },
    };
    let passe = false;

    await middleware(req, res, () => { passe = true; });

    return { passe, res };
  };

  it('signale le premier refus d\'une adresse, une seule fois par fenêtre', async () => {
    const middleware = fabriquer('authentification');

    expect((await frapper(middleware)).passe).toBe(true);
    expect((await frapper(middleware)).passe).toBe(true);

    const refus = await frapper(middleware);
    await frapper(middleware);
    await frapper(middleware);

    expect(refus.passe).toBe(false);
    expect(refus.res.statutHttp).toBe(429);
    expect(refus.res.corps).toEqual(message);
    expect(lignes(warn)).toEqual([
      '[RateLimit] authentification : 203.0.113.7 bloqué sur POST /api/auth/login après 2 requêtes',
    ]);
    // express-rate-limit signale par console.error une option ou une requête qu'il juge mal formée.
    expect(error).not.toHaveBeenCalled();
  });

  it('signale chaque adresse bloquée séparément', async () => {
    const middleware = fabriquer('authentification');

    for (const ip of ['203.0.113.7', '198.51.100.9']) {
      for (let i = 0; i < 3; i += 1) await frapper(middleware, { ip });
    }

    expect(lignes(warn)).toHaveLength(2);
    expect(lignes(warn)[1]).toContain('198.51.100.9');
  });

  it('ne recopie ni la query string ni un jeton du chemin', async () => {
    const jeton = 'a'.repeat(64);
    const webhook = fabriquer('webhook Brevo');
    const confirmation = fabriquer('global');

    for (let i = 0; i < 3; i += 1) {
      await frapper(webhook, { url: '/api/emails/brevo?s=secret-du-webhook' });
      await frapper(confirmation, { url: `/api/auth/confirm/${jeton}` });
    }

    const sortie = lignes(warn).join('\n');
    expect(sortie).toContain('/api/emails/brevo après');
    expect(sortie).not.toContain('secret-du-webhook');
    expect(sortie).not.toContain(jeton);
    expect(sortie).toContain('[jeton masqué]');
  });

  it('passe tous par la fabrique : aucun module n\'importe express-rate-limit directement', async () => {
    const racine = new URL('../../src/', import.meta.url).pathname;
    const fichiers = (await readdir(racine, { recursive: true })).filter((f) => f.endsWith('.js'));
    const importeurs = [];

    for (const fichier of fichiers) {
      const source = await readFile(join(racine, fichier), 'utf8');
      if (/from ['"]express-rate-limit['"]/.test(source)) importeurs.push(fichier);
    }

    expect(importeurs).toEqual(['middlewares/rateLimit.middleware.js']);
  });
});
