/* Les drapeaux restés levés sur un envoi qui n'a jamais eu lieu.

   Trois endroits du projet posent un drapeau en base AVANT d'envoyer un e-mail,
   et le relâchent si l'envoi échoue : le rappel de renouvellement, l'avis de
   dépôt de chèque, et l'envoi d'une newsletter. C'est le bon arbitrage, et il
   est assumé partout où il apparaît — la base arbitre, deux instances ne
   peuvent pas doubler un envoi, et l'on préfère rater un message qu'en envoyer
   deux.

   Reste une brèche, la même aux trois endroits : si le processus meurt entre la
   prise et le relâchement — un redéploiement au mauvais moment — le drapeau
   reste levé sur un envoi qui n'est jamais parti. Le rappel n'arrivera jamais,
   la newsletter restera « en cours d'envoi » pour toujours, et rien ne le dit.

   Ce balayage était trop cher tant qu'on ne savait pas ce qui était réellement
   parti. Depuis qu'EmailLog garde une ligne par message, avec le type d'envoi
   et l'objet concerné, la question se pose en une requête : un drapeau levé
   depuis plus d'une heure sans ligne SENT correspondante est un drapeau
   orphelin. On le relâche, et le job d'origine réessaiera à son prochain
   passage.

   La règle exacte est « aucune ligne SENT », et non « aucune ligne ». Un
   processus mort juste après un refus SMTP laisse une ligne FAILED derrière
   lui : le message n'est pas parti pour autant, le drapeau doit tomber. */

import { prisma } from '../config/database.js';

/* Une heure de sursis. Le plus long envoi du projet — une newsletter à cinq
   cents adhérents — demande moins de cinq minutes ; au-delà d'une heure, un
   drapeau encore levé ne décrit plus un envoi en cours, il décrit un cadavre. */
const GRACE_MS = 60 * 60 * 1000;

/* On ne remonte pas au-delà de sept jours.

   Le raisonnement s'appuie sur EmailLog, qui est purgé à un an : un drapeau
   posé il y a treize mois n'a plus de ligne en face, non pas parce que l'envoi
   a échoué mais parce que la trace a été effacée. Le relâcher réexpédierait un
   rappel de renouvellement vieux d'un an. La fenêtre reste donc courte —
   largement de quoi rattraper un redéploiement ou une panne d'un week-end,
   trop courte pour confondre une trace absente et une trace purgée. */
const FENETRE_MS = 7 * 24 * 60 * 60 * 1000;

const ilYA = (ms) => new Date(Date.now() - ms);

/* Parmi ces objets, lesquels ont réellement reçu leur message ?

   Une seule requête pour toute la fournée, plutôt qu'une par objet : la liste
   des drapeaux suspects est courte, mais elle ne l'est que parce que tout va
   bien — le jour où elle sera longue, ce sera précisément le jour où il ne
   faudra pas marteler la base. */
async function refsRellementServis(kind, refs) {
  if (refs.length === 0) return new Set();

  const lignes = await prisma.emailLog.findMany({
    where: { kind, status: 'SENT', ref: { in: refs } },
    select: { ref: true },
    distinct: ['ref'],
  });

  return new Set(lignes.map((ligne) => ligne.ref));
}

/* Rappels de renouvellement et avis de chèque : même forme, même remède. Le
   drapeau retombe à null, et le job quotidien correspondant refera une
   tentative dès son prochain passage. */
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

/* Une newsletter demande un traitement à part : elle ne s'adresse pas à une
   personne mais à une liste, et le processus a pu mourir au milieu.

   D'où deux issues, tranchées par le nombre de destinataires réellement
   servis. Si personne n'a rien reçu, tout est relâché et la lettre redevient
   renvoyable. Si une partie de la liste a été servie, on ne relâche surtout
   pas — la renvoyer écrirait deux fois aux mêmes personnes. On la close alors
   sur le compte réel, celui qu'EmailLog a mémorisé, qui est plus fiable que le
   compteur figé au moment de la panne. */
async function refermerNewslettersBloquees() {
  const bloquees = await prisma.newsletter.findMany({
    where: {
      status: 'SENDING',
      sentAt: { lte: ilYA(GRACE_MS), gte: ilYA(FENETRE_MS) },
    },
    select: { id: true, subject: true },
  });

  for (const newsletter of bloquees) {
    const servis = await prisma.emailLog.count({
      where: { kind: 'NEWSLETTER', status: 'SENT', ref: newsletter.id },
    });

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: servis > 0
        ? { status: 'SENT', sentCount: servis }
        : { status: 'FAILED', sentAt: null, sentCount: 0 },
    });

    console.warn(
      servis > 0
        ? `[OrphanFlags] Newsletter ${newsletter.id} close sur ${servis} envoi(s) réellement partis : la diffusion s'est interrompue en cours de route`
        : `[OrphanFlags] Newsletter ${newsletter.id} remise en échec : la diffusion n'a atteint personne, elle est de nouveau renvoyable`
    );
  }
}

/* Exportée pour être déclenchable seule — le job périodique n'est qu'un
   ordonnanceur, la logique est ici. */
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

/* Au démarrage puis toutes les heures. Le passage au démarrage est le plus
   utile des deux : la panne qu'on répare est presque toujours un redéploiement,
   et c'est donc au redémarrage suivant que le drapeau orphelin attend. */
export function startOrphanFlagsJob() {
  releaseOrphanFlags();
  setInterval(releaseOrphanFlags, 60 * 60 * 1000);
  console.log('[OrphanFlags] Balayage des drapeaux d\'envoi démarré (au démarrage, puis toutes les heures)');
}
