import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { asyncHandler } from './error.middleware.js';
import { HttpUnauthorizedError } from '../utils/httpErrors.js';

// Middleware d'authentification
const authMiddleware = asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.authToken;

    if (!token) {
        throw new HttpUnauthorizedError('Token d\'authentification manquant ou invalide.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                emailVerified: true,
                deletedAt: true,
            },
        });

        // Vérifier que l'utilisateur existe et n'est pas supprimé
        if (!user || user.deletedAt) {
            throw new HttpUnauthorizedError('Utilisateur non trouvé ou compte supprimé.');
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            throw new HttpUnauthorizedError('Token d\'authentification invalide ou expiré.');
        }
        throw error;
    }
});

export { authMiddleware };