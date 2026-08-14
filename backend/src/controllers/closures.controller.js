import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';
import {
  MAX_CLOSURE_DAYS_PER_YEAR,
  countClosureDays,
  getYearBounds,
  sumClosureDays
} from '../utils/closurePeriod.js';

function formatDateFR(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function buildClosureEmailHtml(startDate, endDate, reason, isUpdate) {
  const start = formatDateFR(startDate);
  const end = formatDateFR(endDate);
  const title = isUpdate ? 'Fermeture de l\'AMAP — dates modifiées' : 'Fermeture de l\'AMAP';
  const lead = isUpdate
    ? 'Les dates de fermeture annoncées précédemment ont changé.'
    : 'Bonjour,';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    body        { font-family: sans-serif; color: #1f2937; background: #f9fafb; margin: 0; padding: 0; }
    .wrapper    { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header     { background: #166534; padding: 24px 32px; }
    .header h1  { color: #ffffff; margin: 0; font-size: 1.25rem; }
    .body       { padding: 32px; }
    .body p     { line-height: 1.6; margin: 0 0 16px; }
    .highlight  { background: #fef9c3; border-left: 4px solid #ca8a04; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; }
    .reason     { color: #374151; }
    .footer     { padding: 16px 32px; background: #f3f4f6; font-size: 0.8rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="body">
      <p>${lead}</p>
      <div class="highlight">
        <p>L'AMAP sera <strong>fermée du ${start} au ${end}</strong>.<br/>
        Aucune distribution ne sera effectuée pendant cette période.</p>
      </div>
      ${reason ? `<p class="reason"><strong>Motif :</strong> ${reason}</p>` : ''}
      <p>Nous vous retrouverons avec plaisir à la reprise des distributions.</p>
      <p>L'équipe de votre AMAP</p>
    </div>
    <div class="footer">Vous recevez ce message car vous êtes abonné(e) à l'AMAP.</div>
  </div>
</body>
</html>`;
}

/* Prévenir les adhérents : la newsletter est d'abord écrite en base — elle
   laisse une trace dans /admin/communication — puis envoyée aux abonnés
   actifs. Sans abonné actif, la trace reste, rien ne part. */
async function announceClosure({ closure, adminId, isUpdate }) {
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { user: { select: { email: true, firstName: true } } }
  });
  const recipients = activeSubscriptions.map(subscription => subscription.user);

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

  if (recipients.length === 0) return 0;

  const result = await emailService.sendNewsletter(newsletter, recipients);
  const sentCount = result.results?.sent ?? 0;

  await prisma.newsletter.update({
    where: { id: newsletter.id },
    data: { sentAt: new Date(), sentCount }
  });

  return sentCount;
}

/* Jours déjà consommés sur l'année civile d'une date, la fermeture en cours de
   modification exclue du calcul — sinon elle se compterait contre elle-même. */
async function countDaysUsedInYear(date, excludedId) {
  const { year, start, end } = getYearBounds(date);

  const closures = await prisma.amapClosure.findMany({
    where: {
      startDate: { gte: start, lte: end },
      ...(excludedId && { id: { not: excludedId } })
    }
  });

  return { year, daysUsed: sumClosureDays(closures) };
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

  const daysRequested = countClosureDays(start, end);
  const { year, daysUsed } = await countDaysUsedInYear(start, excludedId);

  if (daysUsed + daysRequested > MAX_CLOSURE_DAYS_PER_YEAR) {
    throw new HttpBadRequestError(
      `Limite de 3 semaines de fermeture atteinte pour ${year}. Jours déjà utilisés : ${daysUsed}/${MAX_CLOSURE_DAYS_PER_YEAR}`
    );
  }

  return { start, end };
}

// LISTER LES FERMETURES
const getAllClosures = asyncHandler(async (req, res) => {
  const closures = await prisma.amapClosure.findMany({
    orderBy: { startDate: 'asc' }
  });

  const { year, start, end } = getYearBounds(new Date());
  const daysUsedThisYear = sumClosureDays(
    closures.filter(closure => closure.startDate >= start && closure.startDate <= end)
  );

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

  const sentCount = notify
    ? await announceClosure({ closure, adminId: req.user.id, isUpdate: false })
    : 0;

  res.json({
    success: true,
    message: notify
      ? `Fermeture créée. Newsletter envoyée à ${sentCount} abonné(s).`
      : 'Fermeture créée. Aucune newsletter envoyée.',
    data: { closure, sentCount, notified: Boolean(notify) }
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

  const sentCount = notify
    ? await announceClosure({ closure: updated, adminId: req.user.id, isUpdate: true })
    : 0;

  res.json({
    success: true,
    message: notify
      ? `Fermeture modifiée. Newsletter envoyée à ${sentCount} abonné(s).`
      : 'Fermeture modifiée. Aucune newsletter envoyée.',
    data: { closure: updated, sentCount, notified: Boolean(notify) }
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

  res.json({ success: true, message: 'Fermeture supprimée' });
});

export { getAllClosures, createClosure, updateClosure, deleteClosure };
