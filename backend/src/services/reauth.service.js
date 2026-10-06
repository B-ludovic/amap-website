import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { logAudit } from './audit.service.js';
import { HttpForbiddenError } from '../utils/httpErrors.js';

/* Redemande le mot de passe de la session avant un geste sur un compte. Les refus
   sont journalisés : une invite que personne ne compte permet de deviner le mot
   de passe depuis une session laissée ouverte. */
export async function confirmPassword(req, password, { cible, details = {}, refus }) {
  // req.user ne porte pas l'empreinte : on la relit pour cette seule comparaison.
  const compte = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { password: true }
  });

  const valide = typeof password === 'string'
    && password.length > 0
    && compte !== null
    && await bcrypt.compare(password, compte.password);

  if (valide) return;

  await logAudit(req, 'FAILED_ACCOUNT_REAUTH', 'CRITICAL', cible, {
    ...details,
    motif: password ? 'mot de passe incorrect' : 'mot de passe absent'
  });

  // 403 et non 401 : le client lit tout 401 comme une session expirée et déconnecte.
  throw new HttpForbiddenError(`Mot de passe incorrect : ${refus}`);
}
