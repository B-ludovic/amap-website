/* Le guichet du désabonnement.

   Trois portes mènent au même réglage. Celle du pied de page d'un email, ouverte
   par le sceau que l'URL transporte, sans session ni mot de passe. Celle du
   client mail, qui poste directement sur la même adresse quand l'abonné clique
   sur le bouton « Se désabonner » de Gmail (RFC 8058). Et celle de l'espace
   adhérent, où la personne déjà connectée bascule le réglage depuis sa fiche.

   Les deux premières ne connaissent leur visiteur que par le sceau : c'est
   volontaire, exiger une connexion ici reviendrait à refuser le désabonnement à
   quiconque a oublié son mot de passe. */

import { prisma } from '../config/database.js';
import { CONTACT_EMAIL } from '../config/association.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpBadRequestError } from '../utils/httpErrors.js';
import { isValidUnsubscribeToken } from '../utils/unsubscribeToken.js';

/* « lu***@gmail.com » : assez pour reconnaître sa propre adresse sur l'écran de
   confirmation, pas assez pour livrer celle d'un tiers à l'historique du
   navigateur, au journal d'un proxy ou à l'épaule qui regarde. */
function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

/* Le sceau vaut identité. On vérifie qu'il correspond bien à l'identifiant qui
   l'accompagne avant d'aller chercher quoi que ce soit en base : sans cette
   garde, l'URL deviendrait un annuaire, chaque identifiant essayé répondant
   « ce compte existe » ou « ce compte n'existe pas ». */
async function userFromSignedLink(query) {
  const userId = typeof query.u === 'string' ? query.u : '';
  const token = typeof query.t === 'string' ? query.t : '';

  if (!isValidUnsubscribeToken(userId, token)) {
    return null;
  }

  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, newsletterOptIn: true },
  });
}

/* Un lien mort et un lien forgé reçoivent la même réponse : le second ne doit
   rien apprendre que le premier ne dirait. */
const INVALID_LINK = `Ce lien de désabonnement n'est plus valide. Écrivez-nous à ${CONTACT_EMAIL}, nous le ferons manuellement.`;

// ÉTAT DU LIEN — la page affiche à qui elle parle avant de proposer le bouton
const getUnsubscribeStatus = asyncHandler(async (req, res) => {
  const user = await userFromSignedLink(req.query);

  if (!user) {
    throw new HttpBadRequestError(INVALID_LINK);
  }

  res.json({
    success: true,
    data: { email: maskEmail(user.email), optIn: user.newsletterOptIn },
  });
});

/* SE DÉSABONNER — idempotent : le client mail peut rejouer sa requête, et une
   personne déjà désabonnée qui reclique sur un vieil email doit lire une
   confirmation, pas une erreur. */
const unsubscribe = asyncHandler(async (req, res) => {
  const user = await userFromSignedLink(req.query);

  if (!user) {
    throw new HttpBadRequestError(INVALID_LINK);
  }

  if (user.newsletterOptIn) {
    await prisma.user.update({
      where: { id: user.id },
      data: { newsletterOptIn: false, newsletterOptOutAt: new Date() },
    });
  }

  res.json({
    success: true,
    message: 'C\'est fait : vous ne recevrez plus la lettre d\'information.',
    data: { email: maskEmail(user.email), optIn: false },
  });
});

/* SE RÉABONNER — le doigt glisse, et un désabonnement en un clic se déclenche
   parfois sans intention. Le chemin du retour est sur la même page. */
const resubscribe = asyncHandler(async (req, res) => {
  const user = await userFromSignedLink(req.query);

  if (!user) {
    throw new HttpBadRequestError(INVALID_LINK);
  }

  if (!user.newsletterOptIn) {
    await prisma.user.update({
      where: { id: user.id },
      data: { newsletterOptIn: true, newsletterOptOutAt: null },
    });
  }

  res.json({
    success: true,
    message: 'Vous êtes de nouveau inscrit(e) à la lettre d\'information.',
    data: { email: maskEmail(user.email), optIn: true },
  });
});

// LE MÊME RÉGLAGE DEPUIS L'ESPACE ADHÉRENT — la session tient lieu de sceau
const setMyNewsletterPreference = asyncHandler(async (req, res) => {
  const { optIn } = req.body;

  if (typeof optIn !== 'boolean') {
    throw new HttpBadRequestError('Préférence invalide.');
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { newsletterOptIn: optIn, newsletterOptOutAt: optIn ? null : new Date() },
    select: { newsletterOptIn: true },
  });

  res.json({
    success: true,
    message: optIn
      ? 'Vous recevrez de nouveau la lettre d\'information.'
      : 'Vous ne recevrez plus la lettre d\'information.',
    data: { optIn: user.newsletterOptIn },
  });
});

export {
  getUnsubscribeStatus,
  unsubscribe,
  resubscribe,
  setMyNewsletterPreference,
};
