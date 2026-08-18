// Classe de base pour toutes nos erreurs HTTP custom
class HttpError extends Error {
  /* `code` est un identifiant stable, destiné au front : le message change au
     gré des relectures, lui non. Il ne sert que là où le client doit distinguer
     deux refus de même statut — un mot de passe faux et une adresse non
     confirmée sont tous deux des 401, mais l'un se corrige en réessayant,
     l'autre appelle un renvoi de lien. */
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name; // Donne le nom de la classe
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Erreurs spécialisées avec messages par défaut en français

// 400 - données invalides envoyées par le client
class HttpBadRequestError extends HttpError {
  constructor(message = 'Requête invalide. Vérifiez les données envoyées.') {
    super(message, httpStatusCodes.BAD_REQUEST);
  }
}

// 401 - user pas connecté ou token invalide
class HttpUnauthorizedError extends HttpError {
  constructor(message = 'Authentification requise. Veuillez vous connecter.', code) {
    super(message, httpStatusCodes.UNAUTHORIZED, code);
  }
}

// 403 - user connecté mais pas les droits
class HttpForbiddenError extends HttpError {
  constructor(message = 'Accès interdit. Vous n\'avez pas les permissions nécessaires.') {
    super(message, httpStatusCodes.FORBIDDEN);
  }
}

// 404 - ressource introuvable
class HttpNotFoundError extends HttpError {
  constructor(message = 'Ressource introuvable. La page ou l\'élément demandé n\'existe pas.') {
    super(message, httpStatusCodes.NOT_FOUND);
  }
}

// 409 - conflit (doublon, état invalide, etc)
class HttpConflictError extends HttpError {
  constructor(message = 'Conflit détecté. Cette action ne peut pas être effectuée.') {
    super(message, httpStatusCodes.CONFLICT);
  }
}

// 422 - validation échouée (utile pour Zod)
class HttpUnprocessableEntityError extends HttpError {
  constructor(message = 'Données invalides. Veuillez vérifier les champs du formulaire.') {
    super(message, httpStatusCodes.UNPROCESSABLE_ENTITY);
  }
}

// 429 - trop de requêtes (rate limiting)
class HttpTooManyRequestsError extends HttpError {
  constructor(message = 'Trop de requêtes. Veuillez réessayer plus tard.') {
    super(message, httpStatusCodes.TOO_MANY_REQUESTS);
  }
}

// 500 - erreur serveur interne
class HttpInternalServerError extends HttpError {
  constructor(message = 'Erreur serveur interne. Veuillez réessayer plus tard.') {
    super(message, httpStatusCodes.INTERNAL_SERVER_ERROR);
  }
}

// Constantes des codes HTTP
export const httpStatusCodes = {
  // succès
  OK: 200,
  CREATED: 201,
  // « C'est pris en charge, ce n'est pas terminé » — l'envoi d'une newsletter
  // se poursuit après la réponse, l'état se relit ensuite en base.
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // erreurs client
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // erreurs serveur
  INTERNAL_SERVER_ERROR: 500
};

export {
  HttpError,
  HttpBadRequestError,
  HttpUnauthorizedError,
  HttpForbiddenError,
  HttpNotFoundError,
  HttpConflictError,
  HttpUnprocessableEntityError,
  HttpTooManyRequestsError,
  HttpInternalServerError
};