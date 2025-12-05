import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
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
    const { email, password, fristName, lastName } = req.body;

    // Verifier que tous les champs sont fournis
    if (!email || !password || !fristName || !lastName) {
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

    res.status(httpStatusCodes.CREATED).json({
        succes: true, 
        message: 'Inscription réussie! Veuillez vérifier votre email pour confirmer votre compte.',
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
        succes: true, 
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
    const userId = req.user.id;

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
        succes: true,
        data: {
            user,
        }
    });
});

// Confirmer l'email de l'utilisateur
const confirmEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;

    // Trouver l'utilisateur par le token de confirmation

    res.json({
        succes: true,
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

    // Envoyer l'email de confirmation

    res.json({
        succes: true,
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
    if (!user) {
        throw new HttpNotFoundError('Utilisateur non trouvé.');
    }

    // Generer un token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');

    // TODO: Sauvegarder le token et sa date d'expiration dans la base de données

    return res.json({
        succes: true,
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

    // TODO : Vérifier le token et mettre à jour le mot de passe de l'utilisateur

    res.json({
        succes: true,
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

