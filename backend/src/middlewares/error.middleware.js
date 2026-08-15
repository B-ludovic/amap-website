import { HttpError, httpStatusCodes } from '../utils/httpErrors.js';

const errorHandler = (err, req, res, next) => {
  /* Journaliser n'est pas divulguer. Cette ligne écrit dans les logs du serveur,
     que seule l'équipe consulte ; ce qui doit rester caché, c'est la pile et le
     message brut dans le corps de la réponse HTTP, et cela reste conditionné plus
     bas. La couper en production revenait à n'avoir aucune trace précisément là
     où l'on ne peut pas reproduire : un export qui échoue, une purge qui plante à
     deux heures du matin, personne ne l'apprend jamais. */
  console.error('Erreur capturée:', {
    name: err.name,
    message: err.message,
    path: req.path,
    method: req.method,
  });

  // Si c'est une de nos erreurs HTTP custom
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        type: err.name,
      },
      // En développement, on affiche aussi la stack trace
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Si c'est une erreur de validation Zod
  if (err.name === 'ZodError') {
    return res.status(httpStatusCodes.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        message: 'Erreur de validation des données',
        type: 'ValidationError',
        ...(process.env.NODE_ENV !== 'production' && { details: err.errors }),
      },
    });
  }

  /* Les erreurs Prisma forment deux familles que tout oppose, et le test d'origine
     n'en voyait qu'une.

     Celles qui portent un code « P… » — P2002 pour un doublon, P2025 pour une
     ligne introuvable — décrivent un refus de la base : la requête était bien
     formée, c'est la donnée qui ne passe pas. Le 400 leur convient.

     Le test lui-même se lisait err.code && err.code.startsWith('P'), ce qui
     suppose une chaîne. Certaines erreurs de Node portent un code numérique, et
     (-2).startsWith n'existe pas : le gestionnaire d'erreurs plantait alors
     lui-même, la main repassait au gestionnaire final d'Express, et la réponse
     sortait en texte brut, hors du format { success, error } que le navigateur
     sait lire. D'où le contrôle de type explicite. */
  const isPrismaKnownError = typeof err.code === 'string' && err.code.startsWith('P');

  if (isPrismaKnownError) {
    return res.status(httpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        message: 'Erreur lors de l\'opération en base de données',
        type: 'DatabaseError',
      },
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  /* L'autre famille : PrismaClientValidationError, qui n'a pas de code et
     traversait donc le filtre pour finir dans le fourre-tout anonyme du bas.

     Elle ne dit pas qu'une donnée a été refusée, mais que la requête envoyée à la
     base était malformée — un champ absent du modèle, une valeur d'un type que la
     colonne n'accepte pas. Cela ne peut venir que du serveur : soit le code
     interroge un champ qui n'existe pas, soit il a transmis une saisie sans la
     valider en amont. Dans les deux cas, c'est un défaut à corriger, jamais une
     situation normale.

     D'où le 500 plutôt que le 400 : répondre « requête incorrecte » à quelqu'un
     qui n'a rien fait de mal range le défaut parmi les refus ordinaires, là où il
     doit sonner comme une panne. L'export RGPD est resté cassé sans que personne
     ne s'en aperçoive ; un 400 l'aurait rendu encore plus discret. Le type
     distinct et le log inconditionnel sont là pour qu'on le voie. */
  if (err.name === 'PrismaClientValidationError') {
    console.error('[Erreur] Requête Prisma malformée:', {
      path: req.path,
      method: req.method,
      message: err.message,
    });

    return res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        message: 'Une erreur inattendue s\'est produite',
        type: 'QueryValidationError',
      },
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  // Pour toutes les autres erreurs (erreurs inattendues)
  res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      message: 'Une erreur inattendue s\'est produite',
      type: 'InternalServerError',
    },
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      originalError: err.message
    }),
  });
};


// Evite d'avoir à mettre try/catch partout
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export { errorHandler, asyncHandler };