/* Les adresses auxquelles on cesse d'écrire.

   Un rebond définitif ne dit pas seulement « ce message-là n'est pas arrivé »,
   il dit « cette boîte n'existe plus ». Continuer à lui écrire chaque mercredi
   n'atteint personne et fait monter le taux de rebond du domaine, ce que les
   fournisseurs lisent comme la signature d'une liste mal tenue : les messages
   de toute l'AMAP basculent alors en indésirables.

   Deux portes vers la même liste : le webhook Brevo l'alimente tout seul, et
   l'écran d'administration permet d'en sortir une adresse une fois corrigée. */

import { prisma } from '../config/database.js';

// Brevo renvoie l'adresse telle qu'elle a été saisie ; la garde doit la
// retrouver quelle que soit la casse.
export const normaliserAdresse = (email) => String(email ?? '').trim().toLowerCase();

export async function estSupprimee(email) {
  const adresse = normaliserAdresse(email);
  if (!adresse) return null;

  return prisma.emailSuppression.findUnique({ where: { email: adresse } });
}

/* Un rebond de plus sur une adresse déjà connue ne crée pas de doublon : il
   repousse lastEventAt, ce qui distingue une adresse morte hier d'une adresse
   morte il y a deux ans. Le motif est réécrit — un BLOCKED devenu HARD_BOUNCE
   est une information plus dure, pas un conflit. */
export async function supprimerAdresse({ email, reason, detail = null }) {
  const adresse = normaliserAdresse(email);
  if (!adresse) return null;

  return prisma.emailSuppression.upsert({
    where: { email: adresse },
    create: { email: adresse, reason, detail },
    update: { reason, detail, lastEventAt: new Date() },
  });
}

// Retour en arrière : l'adhérent a corrigé son adresse, ou le rebond venait
// d'une boîte pleine passagère prise pour un rejet définitif.
export async function retablirAdresse(id) {
  return prisma.emailSuppression.delete({ where: { id } });
}

/* Le filtre des envois de masse. Une requête pour toute la liste plutôt qu'une
   par destinataire : cinquante allers-retours pour écarter deux adresses. */
export async function adressesSupprimees(emails) {
  const adresses = [...new Set(emails.map(normaliserAdresse).filter(Boolean))];
  if (adresses.length === 0) return new Set();

  const lignes = await prisma.emailSuppression.findMany({
    where: { email: { in: adresses } },
    select: { email: true },
  });

  return new Set(lignes.map((ligne) => ligne.email));
}
