import { HttpError, httpStatusCodes } from '../utils/httpErrors.js';

const errorHandler = (err, req, res, next) => {
  // Log l'erreur pour le débogage
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
        details: err.errors, // Détails des champs invalides
      },
    });
  }

  // Si c'est une erreur Prisma (base de données)
  if (err.code && err.code.startsWith('P')) {
    return res.status(httpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        message: 'Erreur lors de l\'opération en base de données',
        type: 'DatabaseError',
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