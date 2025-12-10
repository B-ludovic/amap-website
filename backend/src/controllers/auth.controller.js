import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpBadRequestError,
  HttpUnauthorizedError,
  HttpNotFoundError,
  HttpConflictError,
  httpStatusCodes,
} from '../utils/httpErrors.js';

// Token JWT
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

// Inscription d'un nouvel utilisateur
const register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone } = req.body;

    // Verifier que tous les champs sont fournis
    if (!email || !password || !firstName || !lastName) {
        throw new HttpBadRequestError('Tous les champs sont requis.');
    }

    // Verifier si l'utilisateur existe deja
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new HttpConflictError('Un utilisateur avec cet email existe déjà.');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            emailVerified: false,
        }
    });

    // Generer un token JWT
    const token = generateToken(user.id);

    // Envoyer email de bienvenue
    await emailService.sendWelcomeEmail(user);

    res.status(httpStatusCodes.CREATED).json({
        success: true, 
        message: 'Inscription réussie! Consultez votre email pour commencer.',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                emailVerified: user.emailVerified,
            },
            token,
        }
    });
});

// Connexion d'un utilisateur
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Verifier que tous les champs sont fournis
    if (!email || !password) {
        throw new HttpBadRequestError('Email et mot de passe sont requis.');
    }

    // Trouver l'utilisateur par email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new HttpUnauthorizedError('Email ou mot de passe incorrect.');
    }

    // Verifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new HttpUnauthorizedError('Email ou mot de passe incorrect.');
    }

    // Si l'utilisateur a ete supprimé
    if (user.deletedAt) {
        throw new HttpUnauthorizedError('Ce compte a été supprimé.');
    }

    // Generer un token JWT
    const token = generateToken(user.id);

    res.json({
        success: true, 
        message: 'Connexion réussie!',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                emailVerified: user.emailVerified,
            },
            token,
        }
    });
});

// Récupérer les informations de l'utilisateur connecté
const getMe = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
        }
    });

    if (!user) {
        throw new HttpNotFoundError('Utilisateur non trouvé.');
    }

    res.json({
        success: true,
        data: {
            user,
        }
    });
});

// Confirmer l'email de l'utilisateur
const confirmEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    // TODO: Implémenter la vérification du token

    res.json({
        success: true,
        message: 'Email confirmé avec succès!',
    });
});

// Renvoyer l'email de confirmation
const resendConfirmationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new HttpBadRequestError('Email est requis.');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new HttpNotFoundError('Utilisateur non trouvé.');
    }

    if (user.emailVerified) {
        throw new HttpBadRequestError('Email déjà confirmé.');
    }

    // TODO: Envoyer l'email de confirmation

    res.json({
        success: true,
        message: 'Email de confirmation renvoyé avec succès!',
    });
});

// Mot de passe oublié
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new HttpBadRequestError('Email est requis.');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Ne pas révéler si l'utilisateur existe ou non (sécurité)
    if (!user) {
        return res.json({
            success: true,
            message: 'Si un compte avec cet email existe, un email de réinitialisation a été envoyé.',
        });
    }

    // Generer un token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure

    // Sauvegarder le token hashé dans la base
    await prisma.user.update({
        where: { id: user.id },
        data: {
            resetToken: resetTokenHash,
            resetTokenExpiry: resetTokenExpiry,
        }
    });

    // Envoyer email de reset avec le token en clair
    await emailService.sendPasswordResetEmail(user, resetToken);

    res.json({
        success: true,
        message: 'Si un compte avec cet email existe, un email de réinitialisation a été envoyé.',
    });
});

// Réinitialisation du mot de passe
const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        throw new HttpBadRequestError('Nouveau mot de passe est requis.');
    }

    if (newPassword.length < 6) {
        throw new HttpBadRequestError('Le mot de passe doit contenir au moins 6 caractères.');
    }

    // Hasher le token reçu pour le comparer
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Trouver l'utilisateur avec ce token
    const user = await prisma.user.findFirst({
        where: {
            resetToken: tokenHash,
            resetTokenExpiry: {
                gt: new Date(), // Token non expiré
            },
        },
    });

    if (!user) {
        throw new HttpBadRequestError('Token invalide ou expiré.');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe et supprimer le token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
        },
    });

    res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès!',
    });
});

export {
    register,
    login,
    getMe,
    confirmEmail,
    resendConfirmationEmail,
    forgotPassword,
    resetPassword
};