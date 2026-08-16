/* Envoyer les newsletters dont l'heure de programmation est passée : sans ce
   balayage, poser une date n'est qu'une promesse d'interface. */

import { prisma } from '../config/database.js';
import { resolveNewsletterRecipients } from '../services/newsletterAudience.service.js';
import { ETATS_DE_DEPART, reserverNewsletter, diffuserNewsletter } from '../services/newsletterDispatch.service.js';

/* Un serveur arrêté une semaine enverrait sinon d'un coup des textes périmés,
   et les dates posées avant la mise en service de ce job avec eux. */
const RETARD_MAX_MS = 24 * 60 * 60 * 1000;

// Aucune main sur le bouton : le journal d'audit portera « système ».
const ACTEUR_SYSTEME = { user: null, ip: null };

// Pas d'administratrice connectée à qui adresser un test : l'auteure en tient lieu.
async function destinatairesDe(newsletter) {
  if (newsletter.target !== 'TEST') {
    return resolveNewsletterRecipients({ target: newsletter.target, type: newsletter.type });
  }

  const auteur = newsletter.createdBy && await prisma.user.findFirst({
    where: { id: newsletter.createdBy, deletedAt: null },
    select: { id: true, email: true, firstName: true },
  });

  return auteur ? [auteur] : [];
}

export async function envoyerNewslettersProgrammees() {
  try {
    const maintenant = new Date();

    const dues = await prisma.newsletter.findMany({
      where: {
        scheduledFor: { lte: maintenant },
        status: { in: ETATS_DE_DEPART },
      },
    });

    for (const newsletter of dues) {
      if (maintenant - newsletter.scheduledFor > RETARD_MAX_MS) {
        console.warn(`[NewsletterProgrammée] ${newsletter.id} périmée, repassée en brouillon : attendue le ${newsletter.scheduledFor.toISOString()}`);
        await prisma.newsletter.update({ where: { id: newsletter.id }, data: { scheduledFor: null } });
        continue;
      }

      const recipients = await destinatairesDe(newsletter);

      // Le drapeau tranche aussi entre deux instances.
      if (!await reserverNewsletter(newsletter.id)) continue;

      console.log(`[NewsletterProgrammée] ${newsletter.id} lancée vers ${recipients.length} destinataire(s)`);

      await diffuserNewsletter({ id: newsletter.id, newsletter, recipients, trace: ACTEUR_SYSTEME });
    }
  } catch (error) {
    console.error('[NewsletterProgrammée] Erreur lors du balayage des newsletters dues :', error);
  }
}

export function startScheduledNewsletterJob() {
  envoyerNewslettersProgrammees();
  setInterval(envoyerNewslettersProgrammees, 15 * 60 * 1000);

  console.log('[NewsletterProgrammée] Envoi des newsletters programmées actif (toutes les 15 minutes)');
}
