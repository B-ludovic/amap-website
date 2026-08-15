import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { reserverNewsletter, lancerDiffusion } from '../services/newsletterDispatch.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';
import {
  MAX_CLOSURE_DAYS_PER_YEAR,
  countClosureDaysInYear,
  getUtcDayBounds,
  getYearBounds,
  sumClosureDays
} from '../utils/closurePeriod.js';
import { formatDateFR } from '../services/closure.service.js';
import { resolveNewsletterRecipients } from '../services/newsletterAudience.service.js';
import { EMAIL_PALETTE } from '../services/emailTheme.js';
import { logAudit } from '../services/audit.service.js';

/* Le motif est écrit par un administrateur, mais il finit dans un e-mail : on
   l'échappe à la source plutôt que de compter sur le nettoyage en aval. Deux
   filtres valent mieux qu'un quand le second est à trois fichiers de distance. */
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ANNONCE DE FERMETURE — fragment, et non document.

   Cette fonction produisait un document HTML complet : DOCTYPE, <head>, feuille
   de style, <body> avec son propre en-tête et son propre pied de page. Or son
   résultat n'est pas envoyé tel quel — il devient le contenu d'une Newsletter,
   que sendNewsletter insère au milieu de son propre gabarit. Un document dans un
   document, avec trois conséquences visibles dans la boîte de l'adhérent.

   La feuille de style était retirée par le nettoyage en aval, qui ne conserve
   que le corps : les classes restaient, leurs règles disparaissaient. Les noms
   de classes — wrapper, header, footer — sont par ailleurs ceux du gabarit
   englobant, si bien que le titre de la fermeture récupérait le style du grand
   en-tête « Aux P'tits Pois » et la mention finale celui du pied de page :
   l'adhérent recevait deux bandeaux et deux pieds. Enfin l'indentation du
   gabarit, trente-quatre retours à la ligne, était convertie en vingt-cinq
   <br> par sendNewsletter — sept lignes vides avant même le premier mot.

   D'où un fragment : uniquement ce qui doit s'afficher dans la zone de contenu,
   en une seule ligne pour ne rien donner à convertir, et stylé en ligne. Les
   styles en ligne ne sont pas un pis-aller ici, c'est la règle du courrier
   électronique : une bonne partie des clients de messagerie ignorent ou retirent
   les blocs <style>, et celui-ci était de toute façon supprimé avant l'envoi.

   Les couleurs viennent d'EMAIL_PALETTE et non de valeurs écrites ici : le
   fragment reste autonome — il s'affiche même si le client de messagerie jette
   la feuille de style du gabarit — sans pour autant devenir un endroit de plus
   où la charte peut dériver. */
function buildClosureEmailHtml(startDate, endDate, reason, isUpdate) {
  const start = formatDateFR(startDate);
  const end = formatDateFR(endDate);
  /* Pas de titre dans le fragment : le gabarit coiffe désormais le message avec
     le sujet de la newsletter, qui dit déjà « Fermeture de l'AMAP du … au … ».
     Un titre ici le répéterait deux lignes plus bas. */
  const lead = isUpdate
    ? 'Les dates de fermeture annoncées précédemment ont changé.'
    : 'Bonjour,';

  const highlight = `background:${EMAIL_PALETTE.sand};border-left:3px solid ${EMAIL_PALETTE.terracotta};padding:16px 20px;border-radius:0 4px 4px 0;margin:0 0 16px;`;
  const motif = reason
    ? `<p style="color:${EMAIL_PALETTE.textSecondary};margin:0 0 16px;"><strong>Motif :</strong> ${escapeHtml(reason)}</p>`
    : '';

  return [
    `<p style="margin:0 0 16px;">${lead}</p>`,
    `<div style="${highlight}">`,
    `<p style="margin:0;">L'AMAP sera <strong>fermée du ${start} au ${end}</strong>.`,
    ' Aucune distribution ne sera effectuée pendant cette période.</p>',
    '</div>',
    motif,
    '<p style="margin:0 0 16px;">Nous vous retrouverons avec plaisir à la reprise des distributions.</p>',
    '<p style="margin:0;">L\'équipe de votre AMAP</p>',
  ].join('');
}

/* Prévenir les adhérents : la newsletter est d'abord écrite en base — elle
   laisse une trace dans /admin/communication — puis envoyée aux abonnés
   actifs. Sans abonné actif, la trace reste, rien ne part. */
async function announceClosure({ closure, adminId, isUpdate }) {
  /* Type ALERT : cette annonce-là part aussi aux adhérents qui ont quitté la
     lettre d'information. Une distribution annulée conditionne le retrait d'un
     panier déjà payé — se taire enverrait quelqu'un attendre devant une porte
     close un mercredi soir. Le pied de page de l'email le leur dit. */
  const recipients = await resolveNewsletterRecipients({
    target: 'ACTIVE_SUBSCRIBERS',
    type: 'ALERT'
  });

  const prefix = isUpdate ? 'Fermeture de l\'AMAP modifiée' : 'Fermeture de l\'AMAP';
  const newsletter = await prisma.newsletter.create({
    data: {
      subject: `${prefix} du ${formatDateFR(closure.startDate)} au ${formatDateFR(closure.endDate)}`,
      content: buildClosureEmailHtml(closure.startDate, closure.endDate, closure.reason, isUpdate),
      type: 'ALERT',
      target: 'ACTIVE_SUBSCRIBERS',
      createdBy: adminId
    }
  });

  if (recipients.length === 0) return { lancee: false, recipientsCount: 0 };

  /* Même mécanique que l'envoi manuel, et pour la même raison : deux cents
     abonnés demandent près de deux minutes d'envoi, que la requête de
     l'administratrice n'a pas à porter. On réserve, on lance, on rend la main.

     L'annonce vient d'être créée, sa réservation ne peut donc pas échouer — mais
     on la teste tout de même plutôt que de supposer, un enregistrement de
     fermeture déclenché deux fois passant par ici deux fois. */
  const reservee = await reserverNewsletter(newsletter.id);

  if (!reservee) return { lancee: false, recipientsCount: recipients.length };

  lancerDiffusion({ id: newsletter.id, newsletter, recipients });

  return { lancee: true, recipientsCount: recipients.length, newsletterId: newsletter.id };
}

/* Ce que l'administratrice lit après coup.

   Le compte des envois réussis ne peut plus figurer ici : au moment où cette
   phrase se compose, la diffusion commence à peine. C'est un renseignement en
   moins dans la fenêtre de confirmation, et c'est le prix du découplage — il se
   retrouve, complet et à jour, dans l'écran de communication, là où le statut de
   l'annonce vit désormais. */
function closureNotice(base, { lancee, recipientsCount }) {
  if (!lancee) {
    return recipientsCount === 0
      ? `${base} Aucun abonné actif : aucune annonce envoyée.`
      : `${base} L'annonce n'a pas pu être lancée, elle reste disponible dans l'écran Communication.`;
  }

  return `${base} Annonce en cours d'envoi vers ${recipientsCount} abonné(s) : le suivi s'affiche dans l'écran Communication.`;
}

/* Jours déjà consommés sur l'année civile d'une date, la fermeture en cours de
   modification exclue du calcul — sinon elle se compterait contre elle-même. */
async function countDaysUsedInYear(year, excludedId) {
  const { start, end } = getYearBounds(new Date(Date.UTC(year, 0, 1)));

  const closures = await prisma.amapClosure.findMany({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludedId && { id: { not: excludedId } })
    }
  });

  return { year, daysUsed: sumClosureDays(closures, year) };
}

/* Une permanence programmée dit « rendez-vous ce jour-là », une fermeture dit
   l'inverse. Les deux ne peuvent pas coexister : le contrôleur des permanences
   empêche déjà d'en poser une sur un jour fermé, il faut fermer l'autre sens et
   empêcher d'envelopper une permanence dans une fermeture.

   On refuse plutôt que de supprimer d'office : effacer enverrait le même jour
   deux emails contradictoires au même bénévole — une annulation de permanence
   et une annonce de fermeture — et l'administrateur perdrait la trace de ce
   qu'il vient de détruire. Le refus le force à nettoyer en connaissance de
   cause.

   Seules les permanences encore à venir bloquent : une permanence déjà tenue
   est de l'histoire, elle ne promet plus rien à personne. */
async function refuseIfShiftsPlanned({ start, end }) {
  const now = new Date();
  const from = getUtcDayBounds(start).start;
  const to = getUtcDayBounds(end).end;

  if (to < now) return;

  const shifts = await prisma.shift.findMany({
    where: {
      distributionDate: { gte: from > now ? from : now, lte: to }
    },
    orderBy: { distributionDate: 'asc' },
    select: { distributionDate: true }
  });

  if (shifts.length === 0) return;

  const dates = shifts.map(shift => formatDateFR(shift.distributionDate)).join(', ');

  throw new HttpBadRequestError(
    shifts.length === 1
      ? `Une permanence est programmée pendant cette période, le ${dates}. Supprimez-la ou déplacez-la avant de déclarer la fermeture.`
      : `${shifts.length} permanences sont programmées pendant cette période : ${dates}. Supprimez-les ou déplacez-les avant de déclarer la fermeture.`
  );
}

/* Contrôle commun à la création et à la modification : dates cohérentes et
   quota annuel respecté. */
async function validateClosurePeriod({ startDate, endDate, excludedId }) {
  if (!startDate || !endDate) {
    throw new HttpBadRequestError('Dates de début et fin requises');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpBadRequestError('Dates invalides');
  }

  if (end < start) {
    throw new HttpBadRequestError('La date de fin ne peut pas précéder la date de début');
  }

  const overlappingClosure = await prisma.amapClosure.findFirst({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludedId && { id: { not: excludedId } })
    }
  });

  if (overlappingClosure) {
    throw new HttpBadRequestError('Cette fermeture chevauche une fermeture existante');
  }

  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    const daysRequested = countClosureDaysInYear(start, end, year);
    const { daysUsed } = await countDaysUsedInYear(year, excludedId);

    if (daysUsed + daysRequested > MAX_CLOSURE_DAYS_PER_YEAR) {
      throw new HttpBadRequestError(
        `Limite de 3 semaines de fermeture atteinte pour ${year}. Jours déjà utilisés : ${daysUsed}/${MAX_CLOSURE_DAYS_PER_YEAR}`
      );
    }
  }

  await refuseIfShiftsPlanned({ start, end });

  return { start, end };
}

// LISTER LES FERMETURES
const getAllClosures = asyncHandler(async (req, res) => {
  const closures = await prisma.amapClosure.findMany({
    orderBy: { startDate: 'asc' }
  });

  const { year, start, end } = getYearBounds(new Date());
  const daysUsedThisYear = sumClosureDays(closures, year);

  res.json({
    success: true,
    data: {
      closures,
      year,
      maxDaysPerYear: MAX_CLOSURE_DAYS_PER_YEAR,
      daysUsedThisYear,
      daysRemainingThisYear: Math.max(0, MAX_CLOSURE_DAYS_PER_YEAR - daysUsedThisYear)
    }
  });
});

// CRÉER UNE FERMETURE
const createClosure = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason, notify = true } = req.body;

  const { start, end } = await validateClosurePeriod({ startDate, endDate });

  const closure = await prisma.amapClosure.create({
    data: { startDate: start, endDate: end, reason: reason || null }
  });

  const annonce = notify
    ? await announceClosure({ closure, adminId: req.user.id, isUpdate: false })
    : { lancee: false, recipientsCount: 0 };

  await logAudit(req, 'CREATE_CLOSURE', 'IMPORTANT', {
    type: 'AMAP_CLOSURE',
    id: closure.id,
    label: `${formatDateFR(closure.startDate)} au ${formatDateFR(closure.endDate)}`
  }, { notified: Boolean(notify), announcementLaunched: annonce.lancee, recipientsCount: annonce.recipientsCount });

  res.json({
    success: true,
    message: notify
      ? closureNotice('Fermeture créée.', annonce)
      : 'Fermeture créée. Aucune newsletter envoyée.',
    data: { closure, announcement: annonce, notified: Boolean(notify) }
  });
});

/* MODIFIER UNE FERMETURE
   Même garde-fou que la suppression : une fermeture commencée est un fait
   accompli, les adhérents ont déjà organisé leur semaine autour. Seule une
   fermeture encore à venir se corrige. */
const updateClosure = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, reason, notify = false } = req.body;

  const closure = await prisma.amapClosure.findUnique({ where: { id } });

  if (!closure) {
    throw new HttpNotFoundError('Fermeture introuvable');
  }

  if (new Date(closure.startDate) <= new Date()) {
    throw new HttpBadRequestError('Impossible de modifier une fermeture passée ou en cours');
  }

  const { start, end } = await validateClosurePeriod({ startDate, endDate, excludedId: id });

  const updated = await prisma.amapClosure.update({
    where: { id },
    data: { startDate: start, endDate: end, reason: reason || null }
  });

  const annonce = notify
    ? await announceClosure({ closure: updated, adminId: req.user.id, isUpdate: true })
    : { lancee: false, recipientsCount: 0 };

  await logAudit(req, 'UPDATE_CLOSURE', 'IMPORTANT', {
    type: 'AMAP_CLOSURE',
    id,
    label: `${formatDateFR(updated.startDate)} au ${formatDateFR(updated.endDate)}`
  }, {
    before: { startDate: closure.startDate, endDate: closure.endDate },
    after: { startDate: updated.startDate, endDate: updated.endDate },
    notified: Boolean(notify),
    announcementLaunched: annonce.lancee,
    recipientsCount: annonce.recipientsCount
  });

  res.json({
    success: true,
    message: notify
      ? closureNotice('Fermeture modifiée.', annonce)
      : 'Fermeture modifiée. Aucune newsletter envoyée.',
    data: { closure: updated, announcement: annonce, notified: Boolean(notify) }
  });
});

// SUPPRIMER UNE FERMETURE
const deleteClosure = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const closure = await prisma.amapClosure.findUnique({ where: { id } });

  if (!closure) {
    throw new HttpNotFoundError('Fermeture introuvable');
  }

  if (new Date(closure.startDate) <= new Date()) {
    throw new HttpBadRequestError('Impossible de supprimer une fermeture passée ou en cours');
  }

  await prisma.amapClosure.delete({ where: { id } });

  await logAudit(req, 'DELETE_CLOSURE', 'IMPORTANT', {
    type: 'AMAP_CLOSURE',
    id,
    label: `${formatDateFR(closure.startDate)} au ${formatDateFR(closure.endDate)}`
  });

  res.json({ success: true, message: 'Fermeture supprimée' });
});

export { getAllClosures, createClosure, updateClosure, deleteClosure };
