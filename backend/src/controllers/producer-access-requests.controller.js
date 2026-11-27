import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError, HttpConflictError, HttpForbiddenError, httpStatusCodes } from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { formatDateFR } from '../services/closure.service.js';
import { ProducerAccessRequestSchema } from '../utils/validation.schemas.js';

const REDEPOT_APRES_REFUS_JOURS = 30;

const REFUS = {
  EMAIL_NON_VERIFIE: () => new HttpForbiddenError('Confirmez votre adresse email avant de demander un accès producteur.'),
  COMPTE_ADMIN:      () => new HttpForbiddenError('Un compte administrateur ne peut pas être rattaché à une ferme.'),
  DEJA_RATTACHE:     () => new HttpConflictError('Votre compte est déjà rattaché à une ferme.'),
  DEMANDE_EN_ATTENTE: () => new HttpConflictError('Vous avez déjà une demande en attente.'),
  REFUS_RECENT:      (redepot) => new HttpConflictError(`Votre dernière demande a été refusée. Vous pourrez en déposer une nouvelle à partir du ${formatDateFR(redepot)}.`),
};

const refuser = async (req, motif, erreur) => {
  await logAudit(req, 'FAILED_PRODUCER_ACCESS_REQUEST', 'IMPORTANT', { type: 'USER', id: req.user.id }, { motif });
  throw erreur;
};

/* La réponse ne dépend jamais de farmClaim : aucune fiche Producer n'est lue
   ici, rien ne dit donc au demandeur si la ferme existe en base. */
export const submitAccessRequest = asyncHandler(async (req, res) => {
  const parsed = ProducerAccessRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    await refuser(req, 'VALIDATION', new HttpBadRequestError(parsed.error.issues[0].message));
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

      const seuil = new Date(Date.now() - REDEPOT_APRES_REFUS_JOURS * 24 * 60 * 60 * 1000);
      const refusRecent = await tx.producerAccessRequest.findFirst({
        where: { userId, status: 'REJECTED', processedAt: { gt: seuil } },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      });
      if (refusRecent) {
        const redepot = new Date(refusRecent.processedAt.getTime() + REDEPOT_APRES_REFUS_JOURS * 24 * 60 * 60 * 1000);
        return { motif: 'REFUS_RECENT', redepot };
      }

      const request = await tx.producerAccessRequest.create({
        data: { userId, farmClaim },
        select: { id: true, farmClaim: true },
      });
      return { request };
    });
  } catch (error) {
    await logAudit(req, 'FAILED_PRODUCER_ACCESS_REQUEST', 'IMPORTANT', { type: 'USER', id: userId }, { motif: 'ERREUR_TECHNIQUE' });
    throw error;
  }

  if (issue.motif) {
    await refuser(req, issue.motif, REFUS[issue.motif](issue.redepot));
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
