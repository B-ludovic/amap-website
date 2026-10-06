/* Le déclencheur externe des jobs. Une horloge hors de Render l'appelle pour
   réveiller le serveur endormi et lancer ce qui est dû ; elle n'a pas de compte,
   c'est le secret partagé qui l'autorise. */

import crypto from 'crypto';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { HttpUnauthorizedError } from '../utils/httpErrors.js';
import { runDueJobs } from '../jobs/scheduler.js';

// Comparaison à temps constant, comme pour le webhook Brevo.
function secretValide(req) {
  const attendu = process.env.JOBS_SECRET;
  if (!attendu) return false;

  const entete = String(req.headers?.authorization ?? '');
  const recu = /^Bearer /i.test(entete) ? entete.slice(7).trim() : '';

  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 500 quand un job a échoué : c'est ce que l'horloge sait lire et signaler.
const runJobsTick = asyncHandler(async (req, res) => {
  if (!secretValide(req)) {
    console.warn('[Planificateur] appel refusé : secret absent ou invalide');
    throw new HttpUnauthorizedError('Accès refusé.');
  }

  const bilan = await runDueJobs();
  const reussi = bilan.echoues.length === 0;

  res.status(reussi ? 200 : 500).json({ success: reussi, data: bilan });
});

export { runJobsTick };
