/* Le job de rétention, contre la base de test : un compte non vérifié de plus de
   trente jours qui porte une demande d'accès producteur survit à la purge, avec
   sa demande. Le même compte sans demande est purgé : preuve que le job a tourné. */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/config/database.js';
import { runRetentionJob } from '../../src/jobs/dataRetention.job.js';

const MARQUE = `retention-${randomUUID()}`;
const IL_Y_A_31_JOURS = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

let debut;
let avecDemande;
let sansDemande;

const compteNonVerifie = (nom, champs = {}) => prisma.user.create({
  data: {
    email: `${MARQUE}-${nom}@example.invalid`,
    password: 'sans-objet',
    firstName: 'Rétention',
    lastName: nom,
    role: 'MEMBER',
    emailVerified: false,
    createdAt: IL_Y_A_31_JOURS,
    ...champs,
  },
});

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  debut = new Date();

  avecDemande = await compteNonVerifie('avec-demande', {
    producerAccessRequests: { create: { farmClaim: 'Ferme de la rétention' } },
  });
  sansDemande = await compteNonVerifie('sans-demande');

  await runRetentionJob();
});

afterAll(async () => {
  const ids = [avecDemande?.id, sansDemande?.id].filter(Boolean);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  if (debut) {
    await prisma.auditLog.deleteMany({
      where: { adminId: null, action: { in: ['PURGE_USER_DATA', 'RETENTION_JOB_RUN'] }, createdAt: { gte: debut } },
    });
  }
  await prisma.$disconnect();
});

describe('Purge des comptes non vérifiés de plus de trente jours', () => {
  it('garde le compte qui porte une demande d\'accès producteur, et sa demande', async () => {
    expect(await prisma.user.findUnique({ where: { id: avecDemande.id } })).not.toBeNull();
    expect(await prisma.producerAccessRequest.count({ where: { userId: avecDemande.id } })).toBe(1);
  });

  it('purge le même compte sans demande', async () => {
    expect(await prisma.user.findUnique({ where: { id: sansDemande.id } })).toBeNull();
  });
});
