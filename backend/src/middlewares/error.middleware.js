import { HttpError, httpStatusCodes } from '../utils/httpErrors.js';

const isProduction = () => process.env.NODE_ENV === 'production';

/* Un jeton n'a rien à faire dans un journal. Certaines routes en portent un dans
   leur chemin — GET /api/auth/confirm/:token —, si bien qu'une erreur survenant
   là écrirait une clé d'activation valide, en clair, dans des logs qui se
   conservent. Les jetons du projet sont des chaînes hexadécimales de 64
   caractères (crypto.randomBytes(32)) ; on masque tout ce qui y ressemble, sans
   toucher aux identifiants UUID, qui portent des tirets, ne sont pas des secrets
   et servent au diagnostic. */
const maskTokens = (value) => String(value).replace(/\b[a-f0-9]{32,}\b/gi, '[jeton masqué]');

/* Le message d'une erreur Prisma récite la requête fautive, données comprises.
   Une saisie du formulaire producteur mal typée produit un message qui contient
   le nom, l'adresse e-mail, le téléphone et l'adresse postale du candidat — les
   journaliser reviendrait à recopier le formulaire dans les logs.

   Ces messages ont une forme constante : première ligne l'opération, dernière
   ligne le diagnostic, et les données entre les deux. On ne garde donc que les
   deux extrémités en production, ce qui conserve tout ce qui sert à corriger —
   le modèle, l'opération, le champ fautif, le type attendu — sans une seule
   valeur. En développement le message reste entier : c'est là qu'il est utile,
   et les données y sont des données de test. */
const safeMessage = (err) => {
  if (!isProduction() || !err.name?.startsWith('PrismaClient')) return maskTokens(err.message);

  const lines = String(err.message).split('\n').map((line) => line.trim()).filter(Boolean);

  if (lines.length < 2) return maskTokens(err.message);

  return maskTokens(`${lines[0]} […] ${lines[lines.length - 1]}`);
};

const errorHandler = (err, req, res, next) => {
  /* Journaliser n'est pas divulguer. Cette ligne écrit dans les logs du serveur,
     que seule l'équipe consulte ; ce qui doit rester caché, c'est la pile et le
     message brut dans le corps de la réponse HTTP, et cela reste conditionné plus
     bas. La couper en production revenait à n'avoir aucune trace précisément là
     où l'on ne peut pas reproduire : un export qui échoue, une purge qui plante à
     deux heures du matin, personne ne l'apprend jamais.

     Journaliser n'est pas non plus tout écrire : le chemin et le message passent
     par les deux filtres ci-dessus, sans quoi cette ligne recopierait des jetons
     et des données personnelles dans des logs conservés par l'hébergeur. */
  console.error('Erreur capturée:', {
    name: err.name,
    message: safeMessage(err),
    path: maskTokens(req.path),
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
      path: maskTokens(req.path),
      method: req.method,
      message: safeMessage(err),
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