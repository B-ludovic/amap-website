import { HttpForbiddenError } from '../utils/httpErrors.js';
import { asyncHandler } from './error.middleware.js';
import { logAudit } from '../services/audit.service.js';

// Middleware pour vérifier que l'utilisateur est admin
const adminOnly = (req, res, next) => {
  // req.user est ajouté par authMiddlewares
  if (!req.user) {
    throw new HttpForbiddenError('Accès refusé. Authentification requise.');
  }

  if (req.user.role !== 'ADMIN') {
    throw new HttpForbiddenError('Accès refusé. Droits administrateur requis.');
  }

  // L'utilisateur est bien admin, on continue
  next();
};

/* Porte de l'espace producteur, après authMiddleware. Il faut le rôle ET le
   rattachement : l'un sans l'autre est un état que rien ne doit produire, donc
   un refus. req.producerId est la seule ferme que les contrôleurs de l'espace
   ont le droit de filtrer, jamais un identifiant venu du corps ou de l'URL. */
const producerOnly = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new HttpForbiddenError('Accès refusé. Authentification requise.');
  }

  const motif = req.user.role !== 'PRODUCER'
    ? 'ROLE_NON_PRODUCTEUR'
    : !req.user.producerId ? 'SANS_RATTACHEMENT' : null;

  if (motif) {
    await logAudit(req, 'FAILED_PRODUCER_SCOPE_CHECK', 'CRITICAL', { type: 'USER', id: req.user.id }, {
      motif,
      method: req.method,
      path: req.originalUrl?.split('?')[0],
    }, motif);
    throw new HttpForbiddenError('Accès refusé. Espace réservé aux producteurs partenaires.');
  }

  req.producerId = req.user.producerId;
  next();
});

export { adminOnly, producerOnly };
