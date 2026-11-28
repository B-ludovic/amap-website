import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError, HttpConflictError, HttpForbiddenError, HttpNotFoundError, httpStatusCodes } from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { confirmPassword } from '../services/reauth.service.js';
import { revokeProducerAccess } from '../services/producerAccess.service.js';
import { formatDateFR } from '../services/closure.service.js';
import {
  ProducerAccessRequestSchema,
  ApproveProducerAccessSchema,
  RejectProducerAccessSchema,
} from '../utils/validation.schemas.js';

// Après un refus ou une révocation, avant une nouvelle demande.
const DELAI_REDEPOT_MS = 30 * 24 * 60 * 60 * 1000;

const REFUS = {
  EMAIL_NON_VERIFIE:  () => new HttpForbiddenError('Confirmez votre adresse email avant de demander un accès producteur.'),
  COMPTE_ADMIN:       () => new HttpForbiddenError('Un compte administrateur ne peut pas être rattaché à une ferme.'),
  DEJA_RATTACHE:      () => new HttpConflictError('Votre compte est déjà rattaché à une ferme.'),
  DEMANDE_EN_ATTENTE: () => new HttpConflictError('Vous avez déjà une demande en attente.'),
  REFUS_RECENT:       (redepot) => new HttpConflictError(`Votre dernière demande a été refusée. Vous pourrez en déposer une nouvelle à partir du ${formatDateFR(redepot)}.`),
  REVOCATION_RECENTE: (redepot) => new HttpConflictError(`Votre accès producteur a été retiré. Vous pourrez déposer une nouvelle demande à partir du ${formatDateFR(redepot)}.`),
};

const journaliserEchec = (req, motif) =>
  logAudit(req, 'FAILED_PRODUCER_ACCESS_REQUEST', 'IMPORTANT', { type: 'USER', id: req.user.id }, { motif }, motif);

/* La réponse ne dépend jamais de farmClaim : aucune fiche Producer n'est lue
   ici, rien ne dit donc au demandeur si la ferme existe en base. */
export const submitAccessRequest = asyncHandler(async (req, res) => {
  const parsed = ProducerAccessRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await journaliserEchec(req, 'VALIDATION');
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { farmClaim } = parsed.data;
  const userId = req.user.id;

  let issue;
  try {
    /* Le verrou sur la ligne du compte range les dépôts simultanés à la file :
       le second voit la demande du premier et ne crée pas de doublon. */
    issue = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, emailVerified: true, producerId: true },
      });

      if (!user.emailVerified) return { motif: 'EMAIL_NON_VERIFIE' };
      if (user.role === 'ADMIN') return { motif: 'COMPTE_ADMIN' };
      if (user.role === 'PRODUCER' || user.producerId) return { motif: 'DEJA_RATTACHE' };

      const enAttente = await tx.producerAccessRequest.findFirst({
        where: { userId, status: 'PENDING' },
        select: { id: true },
      });
      if (enAttente) return { motif: 'DEMANDE_EN_ATTENTE' };

      const seuil = new Date(Date.now() - DELAI_REDEPOT_MS);
      const fermetures = await tx.producerAccessRequest.findMany({
        where: {
          userId,
          OR: [
            { status: 'REJECTED', processedAt: { gt: seuil } },
            { status: 'REVOKED', revokedAt: { gt: seuil } },
          ],
        },
        select: { status: true, processedAt: true, revokedAt: true },
      });
      const derniere = fermetures
        .map((d) => ({ status: d.status, date: d.status === 'REVOKED' ? d.revokedAt : d.processedAt }))
        .sort((a, b) => b.date - a.date)[0];
      if (derniere) {
        return {
          motif: derniere.status === 'REVOKED' ? 'REVOCATION_RECENTE' : 'REFUS_RECENT',
          redepot: new Date(derniere.date.getTime() + DELAI_REDEPOT_MS),
        };
      }

      const request = await tx.producerAccessRequest.create({
        data: { userId, farmClaim },
        select: { id: true, farmClaim: true },
      });
      return { request };
    });
  } catch (error) {
    await journaliserEchec(req, 'ERREUR_TECHNIQUE');
    throw error;
  }

  if (issue.motif) {
    await journaliserEchec(req, issue.motif);
    throw REFUS[issue.motif](issue.redepot);
  }

  await logAudit(req, 'CREATE_PRODUCER_ACCESS_REQUEST', 'IMPORTANT', {
    type: 'PRODUCER_ACCESS_REQUEST',
    id: issue.request.id,
    label: issue.request.farmClaim,
  });

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Votre demande a bien été reçue. Un administrateur la vérifiera.',
  });
});

/* La dernière demande du compte, pour la page de demande d'accès. Jamais
   adminNotes : le refus reste muet. Une demande ne naît qu'après la fermeture
   de la précédente et son délai, la plus récente porte donc la date utile. */
export const getMyAccessRequest = asyncHandler(async (req, res) => {
  const derniere = await prisma.producerAccessRequest.findFirst({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: { status: true, farmClaim: true, createdAt: true, processedAt: true, revokedAt: true },
  });

  if (!derniere) {
    return res.json({ success: true, data: { request: null } });
  }

  const fermeture = derniere.status === 'REJECTED' ? derniere.processedAt
    : derniere.status === 'REVOKED' ? derniere.revokedAt
      : null;
  const redepot = fermeture ? new Date(fermeture.getTime() + DELAI_REDEPOT_MS) : null;

  res.json({
    success: true,
    data: {
      request: {
        status: derniere.status,
        farmClaim: derniere.farmClaim,
        createdAt: derniere.createdAt,
        nextRequestAt: redepot && redepot > new Date() ? redepot : null,
      },
    },
  });
});

// TRAITEMENT PAR L'ADMIN

const STATUTS = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'];

const ERREURS = {
  DEMANDE_INTROUVABLE:  () => new HttpNotFoundError('Demande introuvable.'),
  DEMANDE_DEJA_TRAITEE: () => new HttpConflictError('Cette demande a déjà été traitée.'),
  COMPTE_SUPPRIME:      () => new HttpConflictError('Ce compte a été supprimé.'),
  COMPTE_ADMIN:         () => new HttpConflictError('Un compte administrateur ne peut pas être rattaché à une ferme.'),
  DEJA_RATTACHE:        () => new HttpConflictError('Ce compte est déjà rattaché à une ferme.'),
  FICHE_INTROUVABLE:    () => new HttpNotFoundError('Fiche producteur introuvable.'),
  FICHE_EXEMPLE:        () => new HttpBadRequestError('Une fiche d\'exemple ne peut pas recevoir de compte.'),
  ACCES_NON_ACTIF:      () => new HttpConflictError('Cet accès n\'est pas actif.'),
};

const cibleDemande = (id, email) => ({ type: 'PRODUCER_ACCESS_REQUEST', id, label: email });

const journaliserRefus = (req, geste, motif) =>
  logAudit(req, geste.echec, geste.severite, geste.cible, { motif }, motif);

// Transaction d'un geste admin : tout échec, métier ou technique, laisse sa ligne au journal.
async function executer(req, geste, travail) {
  let issue;
  try {
    issue = await prisma.$transaction(travail);
  } catch (error) {
    await journaliserRefus(req, geste, 'ERREUR_TECHNIQUE');
    throw error;
  }

  if (issue.motif) {
    await journaliserRefus(req, geste, issue.motif);
    throw ERREURS[issue.motif]();
  }
  return issue;
}

const lireDemande = (id) => prisma.producerAccessRequest.findUnique({
  where: { id },
  select: { id: true, userId: true, user: { select: { email: true } } },
});

const verrouiller = async (tx, userId, requestId) => {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProducerAccessRequest" WHERE id = ${requestId} FOR UPDATE`;
};

// LISTE DES DEMANDES (ADMIN)
export const getAllAccessRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  if (status && !STATUTS.includes(status)) {
    throw new HttpBadRequestError(`Statut invalide. Valeurs autorisées : ${STATUTS.join(', ')}`);
  }
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const where = status ? { status } : {};

  const [requests, total] = await Promise.all([
    prisma.producerAccessRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, deletedAt: true } },
      },
    }),
    prisma.producerAccessRequest.count({ where }),
  ]);

  // producerId n'a pas de relation : la trace survit à la fiche, le nom se lit à part.
  const ids = [...new Set(requests.map((r) => r.producerId).filter(Boolean))];
  const fiches = ids.length
    ? await prisma.producer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nomDe = new Map(fiches.map((f) => [f.id, f.name]));

  res.json({
    success: true,
    data: {
      requests: requests.map((r) => ({
        ...r,
        producer: r.producerId ? { id: r.producerId, name: nomDe.get(r.producerId) ?? null } : null,
      })),
      pagination: { page: parsedPage, limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) },
    },
  });
});

// APPROUVER UNE DEMANDE (ADMIN) — rôle et rattachement dans la même transaction
export const approveAccessRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const demande = await lireDemande(id);
  const geste = {
    echec: 'FAILED_PRODUCER_ACCESS_APPROVAL',
    severite: 'CRITICAL',
    cible: cibleDemande(id, demande?.user.email),
  };

  if (!demande) {
    await journaliserRefus(req, geste, 'DEMANDE_INTROUVABLE');
    throw ERREURS.DEMANDE_INTROUVABLE();
  }

  const parsed = ApproveProducerAccessSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await journaliserRefus(req, geste, 'VALIDATION');
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { producerId, adminNotes } = parsed.data;

  await confirmPassword(req, req.body?.password, {
    cible: geste.cible,
    details: { geste: 'APPROVE_PRODUCER_ACCESS_REQUEST', userId: demande.userId, producerId },
    refus: 'l\'accès n\'a pas été accordé',
  });

  const { previousRole } = await executer(req, geste, async (tx) => {
    await verrouiller(tx, demande.userId, id);

    const courante = await tx.producerAccessRequest.findUnique({ where: { id }, select: { status: true } });
    if (!courante) return { motif: 'DEMANDE_INTROUVABLE' };
    if (courante.status !== 'PENDING') return { motif: 'DEMANDE_DEJA_TRAITEE' };

    const user = await tx.user.findUnique({
      where: { id: demande.userId },
      select: { role: true, producerId: true, deletedAt: true },
    });
    if (user.deletedAt) return { motif: 'COMPTE_SUPPRIME' };
    if (user.role === 'ADMIN') return { motif: 'COMPTE_ADMIN' };
    if (user.role === 'PRODUCER' || user.producerId) return { motif: 'DEJA_RATTACHE' };

    const fiche = await tx.producer.findUnique({ where: { id: producerId }, select: { isExample: true } });
    if (!fiche) return { motif: 'FICHE_INTROUVABLE' };
    if (fiche.isExample) return { motif: 'FICHE_EXEMPLE' };

    // tokenVersion : la session ouverte avec l'ancien rôle tombe.
    await tx.user.update({
      where: { id: demande.userId },
      data: { role: 'PRODUCER', producerId, tokenVersion: { increment: 1 } },
    });
    await tx.producerAccessRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        previousRole: user.role,
        producerId,
        adminNotes,
        processedAt: new Date(),
        processedBy: req.user.id,
      },
    });
    return { previousRole: user.role };
  });

  await logAudit(req, 'APPROVE_PRODUCER_ACCESS_REQUEST', 'CRITICAL', geste.cible, {
    userId: demande.userId,
    producerId,
    previousRole,
  });

  res.json({ success: true, message: 'Accès producteur accordé.' });
});

// REFUSER UNE DEMANDE (ADMIN) — le compte reste un adhérent ordinaire
export const rejectAccessRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const demande = await lireDemande(id);
  const geste = {
    echec: 'FAILED_PRODUCER_ACCESS_REJECTION',
    severite: 'IMPORTANT',
    cible: cibleDemande(id, demande?.user.email),
  };

  if (!demande) {
    await journaliserRefus(req, geste, 'DEMANDE_INTROUVABLE');
    throw ERREURS.DEMANDE_INTROUVABLE();
  }

  const parsed = RejectProducerAccessSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await journaliserRefus(req, geste, 'VALIDATION');
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { adminNotes } = parsed.data;

  await executer(req, geste, async (tx) => {
    await verrouiller(tx, demande.userId, id);

    const courante = await tx.producerAccessRequest.findUnique({ where: { id }, select: { status: true } });
    if (!courante) return { motif: 'DEMANDE_INTROUVABLE' };
    if (courante.status !== 'PENDING') return { motif: 'DEMANDE_DEJA_TRAITEE' };

    await tx.producerAccessRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminNotes, processedAt: new Date(), processedBy: req.user.id },
    });
    return {};
  });

  await logAudit(req, 'REJECT_PRODUCER_ACCESS_REQUEST', 'IMPORTANT', geste.cible, { userId: demande.userId });

  res.json({ success: true, message: 'Demande refusée.' });
});

// RÉVOQUER UN ACCÈS (ADMIN) — rôle et rattachement retirés ensemble
export const revokeAccessRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const demande = await lireDemande(id);
  const geste = {
    echec: 'FAILED_PRODUCER_ACCESS_REVOCATION',
    severite: 'CRITICAL',
    cible: cibleDemande(id, demande?.user.email),
  };

  if (!demande) {
    await journaliserRefus(req, geste, 'DEMANDE_INTROUVABLE');
    throw ERREURS.DEMANDE_INTROUVABLE();
  }

  await confirmPassword(req, req.body?.password, {
    cible: geste.cible,
    details: { geste: 'REVOKE_PRODUCER_ACCESS', userId: demande.userId },
    refus: 'l\'accès n\'a pas été retiré',
  });

  const revocation = await executer(req, geste, async (tx) => {
    await verrouiller(tx, demande.userId, id);

    const courante = await tx.producerAccessRequest.findUnique({ where: { id }, select: { status: true } });
    if (!courante) return { motif: 'DEMANDE_INTROUVABLE' };
    if (courante.status !== 'APPROVED') return { motif: 'ACCES_NON_ACTIF' };

    return (await revokeProducerAccess(tx, demande.userId, req.user.id)) ?? { motif: 'ACCES_NON_ACTIF' };
  });

  await logAudit(req, 'REVOKE_PRODUCER_ACCESS', 'CRITICAL', geste.cible, {
    userId: demande.userId,
    producerId: revocation.producerId,
    restoredRole: revocation.role,
  });

  res.json({ success: true, message: 'Accès producteur retiré.' });
});
