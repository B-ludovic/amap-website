import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError
} from '../utils/httpErrors.js';

const MAX_CLOSURE_DAYS_PER_YEAR = 21; // 3 semaines

function formatDateFR(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function buildClosureEmailHtml(startDate, endDate, reason) {
  const start = formatDateFR(startDate);
  const end = formatDateFR(endDate);
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
      <h1>Fermeture de l'AMAP</h1>
    </div>
    <div class="body">
      <p>Bonjour,</p>
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

// LISTER LES FERMETURES
const getAllClosures = asyncHandler(async (req, res) => {
  const closures = await prisma.amapClosure.findMany({
    orderBy: { startDate: 'asc' }
  });

  // Total de jours utilisés cette année civile
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);

  const daysUsedThisYear = closures
    .filter(c => new Date(c.startDate) >= yearStart && new Date(c.startDate) <= yearEnd)
    .reduce((sum, c) =>
      sum + Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86400000), 0
    );

  res.json({
    success: true,
    data: {
      closures,
      daysUsedThisYear,
      daysRemainingThisYear: Math.max(0, MAX_CLOSURE_DAYS_PER_YEAR - daysUsedThisYear)
    }
  });
});

// CRÉER UNE FERMETURE
const createClosure = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason } = req.body;

  if (!startDate || !endDate) {
    throw new HttpBadRequestError('Dates de début et fin requises');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new HttpBadRequestError('La date de fin doit être après la date de début');
  }

  const daysRequested = Math.round((end - start) / 86400000);

  // Vérifier la limite de 3 semaines par année civile
  const year = start.getFullYear();
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31T23:59:59`);

  const existingClosures = await prisma.amapClosure.findMany({
    where: { startDate: { gte: yearStart, lte: yearEnd } }
  });

  const daysUsed = existingClosures.reduce((sum, c) =>
    sum + Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86400000), 0
  );

  if (daysUsed + daysRequested > MAX_CLOSURE_DAYS_PER_YEAR) {
    throw new HttpBadRequestError(
      `Limite de 3 semaines de fermeture atteinte pour ${year}. Jours déjà utilisés : ${daysUsed}/${MAX_CLOSURE_DAYS_PER_YEAR}`
    );
  }

  // Créer la fermeture
  const closure = await prisma.amapClosure.create({
    data: { startDate: start, endDate: end, reason }
  });

  // Récupérer les abonnés actifs
  const activeSubscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { user: { select: { email: true, firstName: true } } }
  });
  const recipients = activeSubscriptions.map(s => s.user);

  // Créer la newsletter (trace dans /admin/communication)
  const newsletter = await prisma.newsletter.create({
    data: {
      subject: `Fermeture de l'AMAP du ${formatDateFR(start)} au ${formatDateFR(end)}`,
      content: buildClosureEmailHtml(start, end, reason),
      target: 'ACTIVE_SUBSCRIBERS',
      createdBy: req.user.id
    }
  });

  // Envoyer si des abonnés actifs existent
  let sentCount = 0;
  if (recipients.length > 0) {
    const result = await emailService.sendNewsletter(newsletter, recipients);
    sentCount = result.results?.sent ?? 0;
    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { sentAt: new Date(), sentCount }
    });
  }

  res.json({
    success: true,
    message: `Fermeture créée. Newsletter envoyée à ${sentCount} abonné(s).`,
    data: { closure, sentCount }
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

export { getAllClosures, createClosure, deleteClosure };
