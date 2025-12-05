import { HttpForbiddenError } from '../utils/httpErrors.js';

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

// Middleware pour vérifier que l'utilisateur est admin OU producteur
const adminOrProducer = (req, res, next) => {
  if (!req.user) {
    throw new HttpForbiddenError('Accès refusé. Authentification requise.');
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'PRODUCER') {
    throw new HttpForbiddenError('Accès refusé. Droits administrateur ou producteur requis.');
  }

  next();
};

export { adminOnly, adminOrProducer };