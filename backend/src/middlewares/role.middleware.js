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

/* Un `adminOrProducer` vivait ici, monté sur aucune route et laissant passer un
   rôle PRODUCER absent de l'enum UserRole : il ne pouvait qu'autoriser un
   administrateur, sous un nom qui promettait l'inverse. Le retirer évite qu'on
   le monte un jour en croyant ouvrir une porte aux producteurs — l'écran des
   utilisateurs avait déjà trébuché sur ce rôle fantôme. */

export { adminOnly };