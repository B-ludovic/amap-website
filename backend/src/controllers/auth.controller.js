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
const generateToken = (userId, tokenVersion) => {
    return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

// Options du cookie d'auth
// secure: false en dev (localhost HTTP), true en prod (HTTPS requis)
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

// Inscription d'un nouvel utilisateur
const register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phone, address } = req.body;

    // Verifier que tous les champs sont fournis
    if (!email || !password || !firstName || !lastName || !phone || !address) {
        throw new HttpBadRequestError('Tous les champs sont requis.');
    }

    if (password.length < 12) {
        throw new HttpBadRequestError('Le mot de passe doit contenir au moins 12 caractères.');
    }

    // Verifier si l'utilisateur existe deja
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new HttpConflictError('Un utilisateur avec cet email existe déjà.');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer un token de vérification email
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyTokenHash = crypto.createHash('sha256').update(emailVerifyToken).digest('hex');
    const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Créer l'utilisateur
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            address,
            emailVerified: false,
            emailVerifyToken: emailVerifyTokenHash,
            emailVerifyTokenExpiry,
        }
    });

    // Envoyer email de vérification
    await emailService.sendEmailVerification(user, emailVerifyToken);

    // En développement, afficher l'URL de confirmation dans la console
    if (process.env.NODE_ENV !== 'production') {
        const verifyUrl = `${process.env.FRONTEND_URL}/auth/confirm-email/${emailVerifyToken}`;
        console.log(`\n🔗 [DEV] URL de confirmation email pour ${email}:\n   ${verifyUrl}\n`);
    }

    res.status(httpStatusCodes.CREATED).json({
        success: true,
        message: 'Inscription réussie ! Consultez votre email pour confirmer votre adresse.',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                emailVerified: user.emailVerified,
            },
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

    // Generer un token JWT (avec version pour révocation) et le poser en cookie HttpOnly
    const token = generateToken(user.id, user.tokenVersion);
    res.cookie('authToken', token, cookieOptions);

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
            address: true,
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

    // Hasher le token reçu pour le comparer avec celui en base
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
        where: {
            emailVerifyToken: tokenHash,
            emailVerifyTokenExpiry: { gt: new Date() },
        },
    });

    if (!user) {
        throw new HttpBadRequestError('Lien de confirmation invalide ou expiré.');
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerified: true,
            emailVerifyToken: null,
            emailVerifyTokenExpiry: null,
        },
    });

    res.json({
        success: true,
        message: 'Email confirmé avec succès !',
    });
});

// Renvoyer l'email de confirmation
const resendConfirmationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new HttpBadRequestError('Email est requis.');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Ne pas révéler si l'utilisateur existe ou non
    if (!user || user.emailVerified) {
        return res.json({
            success: true,
            message: 'Si un compte non confirmé existe avec cet email, un nouveau lien a été envoyé.',
        });
    }

    // Générer un nouveau token
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyTokenHash = crypto.createHash('sha256').update(emailVerifyToken).digest('hex');
    const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerifyToken: emailVerifyTokenHash,
            emailVerifyTokenExpiry,
        },
    });

    await emailService.sendEmailVerification(user, emailVerifyToken);

    if (process.env.NODE_ENV !== 'production') {
        const verifyUrl = `${process.env.FRONTEND_URL}/auth/confirm-email/${emailVerifyToken}`;
        console.log(`\n🔗 [DEV] URL de confirmation email pour ${user.email}:\n   ${verifyUrl}\n`);
    }

    res.json({
        success: true,
        message: 'Si un compte non confirmé existe avec cet email, un nouveau lien a été envoyé.',
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

    if (newPassword.length < 12) {
        throw new HttpBadRequestError('Le mot de passe doit contenir au moins 12 caractères.');
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

// Déconnexion — incrémente tokenVersion pour révoquer immédiatement tous les tokens actifs
const logout = asyncHandler(async (req, res) => {
    if (req.user?.id) {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { tokenVersion: { increment: 1 } },
        });
    }
    res.clearCookie('authToken', { path: '/' });
    res.json({ success: true, message: 'Déconnexion réussie.' });
});

export {
    register,
    login,
    logout,
    getMe,
    confirmEmail,
    resendConfirmationEmail,
    forgotPassword,
    resetPassword
};