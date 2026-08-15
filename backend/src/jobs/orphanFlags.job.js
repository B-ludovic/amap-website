/* Trois endroits posent un drapeau avant d'envoyer et le relâchent en cas
   d'échec : rappel de renouvellement, avis de chèque, newsletter. Un processus
   mort entre les deux laisse le drapeau levé pour toujours.

   Le critère est « aucune ligne SENT dans EmailLog », et non « aucune ligne » :
   un processus mort juste après un refus laisse une ligne FAILED, et le message
   n'est pas parti pour autant. */

import { prisma } from '../config/database.js';

// Le plus long envoi du projet demande moins de cinq minutes.
const GRACE_MS = 60 * 60 * 1000;

/* Borne haute obligatoire : EmailLog est purgé à un an, au-delà une trace
   absente ne prouve rien et le relâchement réexpédierait un vieux rappel. */
const FENETRE_MS = 7 * 24 * 60 * 60 * 1000;

const ilYA = (ms) => new Date(Date.now() - ms);

// Une requête pour toute la fournée : le jour où la liste sera longue sera
// justement celui où il ne faudra pas marteler la base.
async function refsRellementServis(kind, refs) {
  if (refs.length === 0) return new Set();

  const lignes = await prisma.emailLog.findMany({
    where: { kind, status: 'SENT', ref: { in: refs } },
    select: { ref: true },
    distinct: ['ref'],
  });

  return new Set(lignes.map((ligne) => ligne.ref));
}

// Le drapeau retombe à null, le job quotidien réessaiera de lui-même.
async function relacherDrapeauxSimples({ modele, champ, kind, intitule }) {
  const candidats = await prisma[modele].findMany({
    where: { [champ]: { lte: ilYA(GRACE_MS), gte: ilYA(FENETRE_MS) } },
    select: { id: true },
  });

  if (candidats.length === 0) return;

  const servis = await refsRellementServis(kind, candidats.map((c) => c.id));
  const orphelins = candidats.filter((c) => !servis.has(c.id)).map((c) => c.id);

  if (orphelins.length === 0) return;

  const { count } = await prisma[modele].updateMany({
    where: { id: { in: orphelins }, [champ]: { not: null } },
    data: { [champ]: null },
  });

  console.warn(`[OrphanFlags] ${count} ${intitule} relâché(s) : l'envoi n'avait jamais eu lieu, une nouvelle tentative partira au prochain passage`);
}

/* Une newsletter s'adresse à une liste : le processus a pu mourir au milieu.
   Si une partie a été servie, on ne relâche surtout pas — la renvoyer écrirait
   deux fois aux mêmes personnes. */
async function refermerNewslettersBloquees() {
  const bloquees = await prisma.newsletter.findMany({
    where: {
      status: 'SENDING',
      sentAt: { lte: ilYA(GRACE_MS), gte: ilYA(FENETRE_MS) },
    },
    select: { id: true, subject: true },
  });

  for (const newsletter of bloquees) {
    /* Les refus comptés ici sont ceux que le relais a rejetés avant que le
       processus meure. Les destinataires jamais atteints n'ont pas de ligne :
       ce ne sont pas des échecs, ce sont des absences, et c'est le message
       ci-dessous qui les signale. */
    const [servis, refuses] = await Promise.all([
      prisma.emailLog.count({ where: { kind: 'NEWSLETTER', status: 'SENT', ref: newsletter.id } }),
      prisma.emailLog.count({ where: { kind: 'NEWSLETTER', status: 'FAILED', ref: newsletter.id } }),
    ]);

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: servis > 0
        ? { status: 'SENT', sentCount: servis, failedCount: refuses }
        : { status: 'FAILED', sentAt: null, sentCount: 0, failedCount: 0 },
    });

    console.warn(
      servis > 0
        ? `[OrphanFlags] Newsletter ${newsletter.id} close sur ${servis} envoi(s) réellement partis : la diffusion s'est interrompue en cours de route`
        : `[OrphanFlags] Newsletter ${newsletter.id} remise en échec : la diffusion n'a atteint personne, elle est de nouveau renvoyable`
    );
  }
}

// Exportée pour être déclenchable seule.
export async function releaseOrphanFlags() {
  try {
    await relacherDrapeauxSimples({
      modele: 'subscription',
      champ: 'renewalReminderSentAt',
      kind: 'RENEWAL_REMINDER',
      intitule: 'rappel(s) de renouvellement',
    });

    await relacherDrapeauxSimples({
      modele: 'payment',
      champ: 'reminderSentAt',
      kind: 'CHEQUE_DEPOSIT_NOTICE',
      intitule: 'avis de dépôt de chèque',
    });

    await refermerNewslettersBloquees();
  } catch (error) {
    console.error('[OrphanFlags] Erreur lors du balayage des drapeaux :', error);
  }
}

// Le passage au démarrage est le plus utile : la panne est presque toujours un
// redéploiement.
export function startOrphanFlagsJob() {
  releaseOrphanFlags();
  setInterval(releaseOrphanFlags, 60 * 60 * 1000);
  console.log('[OrphanFlags] Balayage des drapeaux d\'envoi démarré (au démarrage, puis toutes les heures)');
}
