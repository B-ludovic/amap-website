/* Ce que Brevo nous rapporte une fois le message parti.

   Le relais accepte un message en quelques millisecondes, puis met des secondes
   ou des heures à le remettre — ou à échouer. EmailLog ne connaissait que la
   première moitié de l'histoire : une ligne SENT y désignait aussi bien un
   message lu qu'un message tombé dans le vide. Le webhook rapporte la seconde.

     #send ──> Brevo ──> EmailLog.status = SENT
                  │
                  └── (plus tard) POST /api/emails/brevo ──> EmailLog.delivery
                                                        └──> EmailSuppression
                                                        └──> newsletterOptIn

   Trois sorties, donc, selon ce que dit l'événement : la trace apprend le sort
   du message, l'adresse morte entre dans la liste des adresses auxquelles on
   n'écrit plus, et la plainte pour spam coupe la lettre d'information sans
   toucher aux messages qui exécutent le contrat. */

import { prisma } from '../config/database.js';
import { normaliserAdresse, supprimerAdresse } from './emailSuppression.service.js';

/* La table de correspondance. `suppression` retire l'adresse de toute
   expédition future ; `optOut` ne coupe que la lettre d'information. Les
   événements absents de cette table — ouvertures, clics, `request` — sont reçus
   sans effet : ils ne disent rien qu'on ait besoin de garder. */
const EVENEMENTS = {
  delivered:     { delivery: 'DELIVERED' },
  deferred:      { delivery: 'DEFERRED' },
  soft_bounce:   { delivery: 'SOFT_BOUNCE' },
  hard_bounce:   { delivery: 'HARD_BOUNCE', suppression: 'HARD_BOUNCE' },
  // Adresse syntaxiquement ou structurellement invalide : même cause, même effet.
  // Deux noms selon l'endroit où Brevo la nomme.
  invalid_email: { delivery: 'HARD_BOUNCE', suppression: 'HARD_BOUNCE' },
  invalid:       { delivery: 'HARD_BOUNCE', suppression: 'HARD_BOUNCE' },
  blocked:       { delivery: 'BLOCKED', suppression: 'BLOCKED' },
  spam:          { delivery: 'SPAM_COMPLAINT', optOut: true },
  unsubscribed:  { optOut: true },
};

/* Nodemailer pose un Message-ID entre chevrons dans l'en-tête et le rend tel
   quel ; Brevo le renvoie tantôt nu, tantôt entouré. On cherche donc les deux
   formes plutôt que de réécrire les lignes déjà en base. */
const formesDuMessageId = (brut) => {
  const nu = String(brut ?? '').trim().replace(/^<|>$/g, '');
  return nu ? [nu, `<${nu}>`] : [];
};

/* Brevo nomme ses événements de deux façons : `hard_bounce` dans la charge
   postée, `hardBounce` dans la liste d'abonnement de son API. On ramène tout au
   même vocabulaire plutôt que de parier sur celui qui arrivera. */
const lireEvenement = (charge) => String(charge?.event ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

/* La plainte pour spam ne supprime pas l'adresse : l'adhérent a un contrat en
   cours, il doit continuer de recevoir l'avis de dépôt de son chèque. Elle
   coupe la lettre d'information, qui est ce dont il s'est plaint. La garde sur
   newsletterOptIn rend l'opération rejouable sans effet. */
async function couperLaLettreDInformation(adresse) {
  const { count } = await prisma.user.updateMany({
    where: { email: { equals: adresse, mode: 'insensitive' }, newsletterOptIn: true },
    data: { newsletterOptIn: false, newsletterOptOutAt: new Date() },
  });

  return count > 0;
}

/* Traite un événement et rend ce qui en a été fait, pour le journal et les
   tests. Ne lève pas : le webhook doit répondre 200 même sur un événement
   biscornu, sans quoi Brevo réessaie en boucle puis coupe l'abonnement. */
export async function traiterEvenementBrevo(charge) {
  const nom = lireEvenement(charge);
  const regle = EVENEMENTS[nom];
  const adresse = normaliserAdresse(charge?.email);

  if (!regle) return { evenement: nom, traite: false, raison: 'événement sans effet' };
  if (!adresse) return { evenement: nom, traite: false, raison: 'événement sans adresse' };

  const effets = [];

  if (regle.delivery) {
    const messageIds = formesDuMessageId(charge?.['message-id'] ?? charge?.messageId);

    /* L'événement daté par Brevo plutôt que par l'horloge du serveur : entre le
       rebond et son arrivée ici, il peut s'être écoulé des heures. */
    const horodatage = dateDeLEvenement(charge);

    const { count } = messageIds.length > 0
      ? await prisma.emailLog.updateMany({
        where: { messageId: { in: messageIds } },
        data: { delivery: regle.delivery, deliveredAt: horodatage },
      })
      : { count: 0 };

    /* Aucune trace retrouvée : le relais a pu réécrire le Message-ID, ou la
       ligne a été purgée. L'adresse, elle, reste exploitable — on applique donc
       la suite, et on le signale plutôt que de laisser croire à une jointure
       qui fonctionne. */
    effets.push(count > 0 ? `trace ${regle.delivery}` : 'trace introuvable');
  }

  if (regle.suppression) {
    await supprimerAdresse({
      email: adresse,
      reason: regle.suppression,
      detail: String(charge?.reason ?? '').slice(0, 500) || null,
    });
    effets.push('adresse supprimée');
  }

  if (regle.optOut && await couperLaLettreDInformation(adresse)) {
    effets.push('lettre d\'information coupée');
  }

  return { evenement: nom, traite: true, effets };
}

/* Brevo envoie `ts_event` et `ts` en secondes epoch, et `date` en texte local.
   Une valeur absente ou illisible retombe sur l'heure de réception, ce qui est
   faux de quelques heures au pire — préférable à une trace sans date. */
function dateDeLEvenement(charge) {
  const secondes = Number(charge?.ts_event ?? charge?.ts);

  if (Number.isFinite(secondes) && secondes > 0) {
    return new Date(secondes * 1000);
  }

  const date = new Date(charge?.date ?? NaN);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
