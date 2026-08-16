/* À qui part une newsletter.

   Deux mains appuient sur « envoyer » dans l'application : l'admin depuis
   /admin/communication, et l'annonce automatique quand une fermeture est
   enregistrée. Chacune dressait sa liste dans son coin, avec le risque qu'une
   règle posée d'un côté manque de l'autre — un désabonnement respecté par
   l'écran d'admin mais ignoré par les fermetures ne vaudrait rien. La liste se
   dresse donc ici, une seule fois, pour les deux.

   Le tri d'opposition : une lettre d'information ordinaire ne part qu'aux
   adhérents qui n'ont pas coupé la diffusion. Une ALERTE passe outre — une
   distribution annulée conditionne le retrait d'un panier déjà payé, cela relève
   de l'exécution du contrat et non de la prospection. Le pied de page de ces
   messages-là le dit franchement à son destinataire (voir email.service.js)
   plutôt que de lui promettre un silence qu'on ne tiendra pas.

   Le revers assumé : marquer une lettre promotionnelle « ALERT » depuis l'admin
   la ferait passer outre les désabonnements. Rien ici ne l'en empêche, seul
   l'usage le retient — et le journal d'audit garde trace de qui a envoyé quoi,
   à quelle liste. */

import { prisma } from '../config/database.js';
import { adressesSupprimees, normaliserAdresse } from './emailSuppression.service.js';

/* Les alertes échappent au désabonnement : elles portent une information de
   service, pas une sollicitation. */
export const overridesOptOut = (type) => type === 'ALERT';

const RECIPIENT_FIELDS = { id: true, email: true, firstName: true };

/* Les adresses mortes sortent de la liste ici plutôt qu'au moment d'écrire :
   écartées une par une à l'envoi, elles laisseraient une ligne FAILED par
   message et par adresse, ce qui ferait passer un envoi sain pour un envoi en
   panne. */
async function sansAdressesMortes(destinataires) {
  const ecartees = await adressesSupprimees(destinataires.map((d) => d.email));
  if (ecartees.size === 0) return destinataires;

  return destinataires.filter((d) => !ecartees.has(normaliserAdresse(d.email)));
}

export async function resolveNewsletterRecipients({ target, type }) {
  /* Un compte supprimé ne reçoit plus rien, alerte comprise : la porte se ferme
     avant le tri des préférences. */
  const optOutFilter = overridesOptOut(type) ? {} : { newsletterOptIn: true };
  const userFilter = { deletedAt: null, ...optOutFilter };

  switch (target) {
    case 'ALL':
      return sansAdressesMortes(await prisma.user.findMany({
        where: userFilter,
        select: RECIPIENT_FIELDS,
      }));

    case 'ACTIVE_SUBSCRIBERS':
    case 'SOLIDARITY': {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          ...(target === 'SOLIDARITY' && { pricingType: 'SOLIDARITY' }),
          user: userFilter,
        },
        include: { user: { select: RECIPIENT_FIELDS } },
      });

      /* On part des contrats, pas des personnes : deux contrats actifs sur la
         même adresse — un panier annuel et une découverte offerte à un proche —
         y feraient arriver le message en double. La Map ne garde qu'une entrée
         par identifiant. */
      return sansAdressesMortes([...new Map(subscriptions.map(({ user }) => [user.id, user])).values()]);
    }

    default:
      return [];
  }
}
