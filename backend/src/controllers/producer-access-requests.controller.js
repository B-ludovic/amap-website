import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError, HttpConflictError, HttpForbiddenError, httpStatusCodes } from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { formatDateFR } from '../services/closure.service.js';
import { ProducerAccessRequestSchema } from '../utils/validation.schemas.js';

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
