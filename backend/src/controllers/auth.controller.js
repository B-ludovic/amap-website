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
  httpStatusCodes,
} from '../utils/httpErrors.js';
import { normalizeFirstName, normalizeLastName, normalizeTitleCase, normalizeEmail } from '../utils/normalize.js';
import { PasswordSchema, RegisterSchema } from '../utils/validation.schemas.js';
import { logAudit } from '../services/audit.service.js';
import { DELETED_ACCOUNT_RETENTION_DAYS } from '../jobs/dataRetention.job.js';

/* Coût du hachage des mots de passe.

   Le coût est un exposant : chaque unité double le travail. Passer de 10 à 12
   quadruple donc le temps qu'il faut pour essayer un mot de passe, ce qui est
   exactement le but — c'est ce qui sépare un fichier de mots de passe volé d'une
   liste de mots de passe en clair.

   Mesuré sur cette base de code, avec bcryptjs qui est du JavaScript pur : un
   hachage passe de 58 à 197 ms. Le vrai coût n'est pas là, il est dans la boucle
   d'événements — cinq connexions simultanées retardent les autres requêtes de
   245 ms au coût 10, de 495 ms au coût 12. La version asynchrone de bcryptjs
   découpe son travail en tranches, mais elle ne le sort pas du processus.

   Le compromis reste bon pour une AMAP : cinq personnes qui se connectent dans
   la même seconde est un pic rare pour une centaine d'adhérents, et le limiteur
   d'authentification plafonne déjà les tentatives à dix par quart d'heure. Si un
   jour cela pèse, la réponse n'est pas de redescendre le coût mais de passer au
   paquet bcrypt natif, qui travaille dans le pool de threads de libuv et rend la
   boucle libre pendant le calcul.

   Les mots de passe déjà en base ne bougent pas : bcrypt inscrit le coût dans le
   hachage lui-même ($2a$10$...), donc les anciens restent vérifiables et se
   voient rehaussés au prochain changement de mot de passe. */
const BCRYPT_COST = 12;

// Token JWT
const generateToken = (userId, tokenVersion) => {
    return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

/* Options du cookie d'auth

   SameSite se calcule sur le site (domaine enregistrable), pas sur l'origine :
   auxptitspois.fr et api.auxptitspois.fr sont same-site, donc Lax suffit pour
   tous les appels du front et ferme structurellement le CSRF — aucune requête
   venue d'un autre site n'emporte le cookie. Conséquence assumée : une
   prévisualisation sur *.vercel.app est cross-site et perd l'authentification.

   Ce « Lax » n'est pas un réglage parmi d'autres : c'est la seule protection
   anti-CSRF de l'application. Il n'existe aucun jeton dans le dépôt, et il n'en
   faut pas tant que cette valeur tient. Le jour où l'API déménage sur un domaine
   étranger au front — amap-api.onrender.com plutôt que api.auxptitspois.fr —,
   l'authentification cassera net, et le réflexe sera de passer à 'None' pour la
   réparer. Ce geste-là, seul, rouvre le CSRF en grand.

   D'où les deux garde-fous ci-dessous plutôt qu'un commentaire de plus : l'un
   refuse de démarrer si la valeur change sans jeton, l'autre prévient quand la
   configuration s'apprête à provoquer ce changement. */
const isProduction = process.env.NODE_ENV === 'production';

const SAME_SITE = 'Lax';

/* Premier garde-fou. Celui qui remplacera 'Lax' par 'None' pour débloquer une
   prévisualisation ou un déménagement d'API se heurtera au démarrage à ce
   message, plutôt que de découvrir six mois plus tard que l'application n'a plus
   aucune défense. Poser CSRF_TOKEN_ENABLED=true est la promesse explicite qu'un
   double-submit cookie a été mis en place — c'est-à-dire un jeton envoyé dans un
   cookie lisible et renvoyé par le front dans un en-tête, que seul un script du
   même site peut lire. */
if (SAME_SITE !== 'Lax' && process.env.CSRF_TOKEN_ENABLED !== 'true') {
    throw new Error(
        `Cookie d'authentification en SameSite=${SAME_SITE} sans protection CSRF. ` +
        'SameSite=Lax est la seule défense anti-CSRF de cette application : la quitter ' +
        'exige d\'introduire un jeton anti-CSRF (double-submit cookie) dans le même commit, ' +
        'puis de poser CSRF_TOKEN_ENABLED=true.'
    );
}

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

/* Domaine enregistrable, approché par ses deux derniers labels. Ce n'est pas la
   liste des suffixes publics — « bbc.co.uk » y serait lu « co.uk » —, mais aucun
   déploiement du projet n'utilise de suffixe à deux niveaux, et l'approximation
   suffit à distinguer auxptitspois.fr de onrender.com ou de vercel.app. */
const registrableDomain = (hostname) => hostname.split('.').slice(-2).join('.');

let crossSiteWarningSent = false;

/* Second garde-fou. Il ne protège de rien par lui-même : il nomme la panne à
   l'instant où elle se produit. Quand l'API pose un cookie Lax depuis un domaine
   étranger à celui du front, le navigateur acceptera le cookie mais ne le
   renverra jamais, et la connexion échouera sans message — la trace la plus
   coûteuse à diagnostiquer qui soit. Une ligne de log ici épargne une soirée, et
   surtout elle rappelle la solution correcte avant que le réflexe 'None' ne
   s'installe. */
const warnIfCrossSite = (req) => {
    if (crossSiteWarningSent || !process.env.FRONTEND_URL) return;

    try {
        const frontDomain = registrableDomain(new URL(process.env.FRONTEND_URL).hostname);
        const apiDomain = registrableDomain(req.hostname);

        if (frontDomain !== apiDomain) {
            crossSiteWarningSent = true;
            console.warn(
                `[Auth] Le cookie est posé depuis « ${req.hostname} » alors que le front est sur ` +
                `« ${frontDomain} » : ces deux domaines sont cross-site, le navigateur ne renverra ` +
                'donc pas un cookie SameSite=Lax et l\'authentification échouera. La réponse n\'est ' +
                'pas de passer à SameSite=None — cela rouvrirait le CSRF — mais de servir l\'API ' +
                'depuis un sous-domaine du front, ou d\'ajouter un jeton anti-CSRF.'
            );
        }
    } catch {
        // FRONTEND_URL malformée : ce diagnostic ne doit jamais empêcher une connexion.
    }
};

// Inscription d'un nouvel utilisateur
const register = asyncHandler(async (req, res) => {
    const { password } = req.body;

    const registerCheck = RegisterSchema.safeParse(req.body);
    if (!registerCheck.success) throw new HttpBadRequestError(registerCheck.error.errors[0].message);

    const { email, firstName, lastName, phone, address } = registerCheck.data;

    const pwdCheck = PasswordSchema.safeParse(password);
    if (!pwdCheck.success) throw new HttpBadRequestError(pwdCheck.error.errors[0].message);

    // Réponse identique que l'email soit libre ou déjà pris : un 409 « existe déjà »
    // permettrait à un tiers de vérifier qui est adhérent, simplement en tentant
    // une inscription à son adresse. Même statut, même corps, dans les deux cas.
    const registrationAccepted = {
        success: true,
        message: 'Inscription réussie ! Consultez votre email pour confirmer votre adresse.',
    };

    // Adresse déjà enregistrée : on prévient son propriétaire au lieu de créer un compte
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        await emailService.sendAccountAlreadyExists(existingUser);
        return res.status(httpStatusCodes.CREATED).json(registrationAccepted);
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // Générer un token de vérification email
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyTokenHash = crypto.createHash('sha256').update(emailVerifyToken).digest('hex');
    const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Créer l'utilisateur
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName: normalizeFirstName(firstName),
            lastName: normalizeLastName(lastName),
            phone,
            address: normalizeTitleCase(address),
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

    res.status(httpStatusCodes.CREATED).json(registrationAccepted);
});

// Connexion d'un utilisateur
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Verifier que tous les champs sont fournis
    if (!email || !password) {
        throw new HttpBadRequestError('Email et mot de passe sont requis.');
    }

    // Trouver l'utilisateur par email
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
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

    if (!user.emailVerified) {
        throw new HttpUnauthorizedError(
            'Veuillez confirmer votre adresse email avant de vous connecter.',
            'EMAIL_NOT_VERIFIED'
        );
    }

    // Generer un token JWT (avec version pour révocation) et le poser en cookie HttpOnly
    const token = generateToken(user.id, user.tokenVersion);
    warnIfCrossSite(req);
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
            // L'espace adhérent affiche et bascule ce réglage depuis sa fiche
            newsletterOptIn: true,
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

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

    // Ne pas révéler si l'utilisateur existe ou non
    if (!user || user.emailVerified) {
        return res.json({
            success: true,
            message: 'Si un compte non confirmé existe avec cet email, un nouveau lien a été envoyé.',
        });
    }

    // Cooldown : 5 minutes entre chaque renvoi
    // emailVerifyTokenExpiry = createdAt + 24h
    // Le token a moins de 5 min si expiry > now + (24h - 5min)
    const COOLDOWN_MS = 5 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (user.emailVerifyTokenExpiry && user.emailVerifyTokenExpiry.getTime() > Date.now() + (DAY_MS - COOLDOWN_MS)) {
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

    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

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
    const { token, password } = req.body;

    // Contrôlé avant tout usage : crypto.update() lève un TypeError brut sur autre
    // chose qu'une chaîne, qui ressortirait en 500 au lieu du message attendu
    if (!token || typeof token !== 'string') {
        throw new HttpBadRequestError('Lien de réinitialisation invalide.');
    }

    if (!password) {
        throw new HttpBadRequestError('Nouveau mot de passe est requis.');
    }

    const pwdCheck = PasswordSchema.safeParse(password);
    if (!pwdCheck.success) throw new HttpBadRequestError(pwdCheck.error.errors[0].message);

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
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

    // Mettre à jour le mot de passe, supprimer le token
    // et révoquer les sessions ouvertes (tokenVersion) : le nouveau mot de passe
    // ne protège rien tant qu'un ancien cookie reste valable
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
            tokenVersion: { increment: 1 },
        },
    });

    /* Prévenir vaut détection : une prise de contrôle par la boîte email ne
       laisse aucune autre trace visible du côté de l'adhérent, qui se découvre
       seulement déconnecté. Un envoi refusé ne remet pas en cause le changement,
       déjà écrit — le service trace son échec sans lever. */
    await emailService.sendPasswordChanged(user);

    res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès!',
    });
});

// Export des données personnelles (RGPD art. 20 — droit à la portabilité)
const exportMe = asyncHandler(async (req, res) => {
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
            /* L'export RGPD doit montrer l'opposition et sa date : c'est la
               preuve que l'association tient de son côté, l'adhérent a droit à
               la même copie. */
            newsletterOptIn: true,
            newsletterOptOutAt: true,
            createdAt: true,
            subscriptionRequests: {
                select: {
                    type: true,
                    basketSize: true,
                    pricingType: true,
                    paymentType: true,
                    status: true,
                    createdAt: true,
                }
            },
            subscriptions: {
                select: {
                    subscriptionNumber: true,
                    type: true,
                    basketSize: true,
                    pricingType: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    price: true,
                    paidAmount: true,
                    pickups: {
                        select: {
                            pickupDate: true,
                            wasPickedUp: true,
                            pickedUpAt: true,
                        }
                    },
                    pauses: {
                        select: {
                            startDate: true,
                            endDate: true,
                            reason: true,
                        }
                    },
                    /* L'argent que l'adhérent a remis le concerne au premier chef :
                       sans le détail des chèques, il ne peut pas vérifier ce que
                       l'association dit détenir, ni contester un montant pièce en
                       main. Le numéro de chèque est de sa main, il lui revient. */
                    payments: {
                        select: {
                            amount: true,
                            status: true,
                            checkNumber: true,
                            receivedAt: true,
                            dueDate: true,
                            depositedAt: true,
                            paidAt: true,
                        }
                    },
                }
            },
            /* Les permanences tenues : une présence datée, avec un rôle et un
               statut d'absence éventuel. C'est bien une donnée sur la personne. */
            shiftVolunteers: {
                select: {
                    role: true,
                    status: true,
                    createdAt: true,
                    shift: {
                        select: {
                            distributionDate: true,
                            startTime: true,
                            endTime: true,
                        }
                    },
                }
            },
            /* Le contenu appartient à l'association (voir la purge RGPD, qui le
               détache au lieu de le détruire), mais la signature est nominative :
               on restitue donc de quoi identifier ce qu'il a écrit, pas le texte. */
            recipes: {
                select: { title: true, slug: true, createdAt: true }
            },
            newsletters: {
                select: { subject: true, createdAt: true, sentAt: true }
            },
        }
    });

    if (!user) {
        throw new HttpNotFoundError('Compte introuvable');
    }

    /* Les messages de contact ne portent aucune relation vers le compte : le
       formulaire est public, il n'enregistre qu'une adresse. Le rapprochement se
       fait donc sur l'e-mail, seule clé disponible. Elle n'est pas vérifiée à
       l'envoi, si bien qu'un message écrit par un tiers sous cette adresse
       apparaîtrait ici — ce serait alors le texte de ce tiers, jamais les
       données d'un autre adhérent. */
    const contactMessages = await prisma.contactMessage.findMany({
        where: { email: user.email },
        select: { subject: true, message: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees-auxptitspois.json"');
    res.json({
        exportDate: new Date().toISOString(),
        source: 'Aux P\'tits Pois — export RGPD art. 20',
        data: { ...user, contactMessages },
    });
});

// Suppression du compte — soft delete + déconnexion immédiate (RGPD art. 17)
const deleteMe = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || user.deletedAt) {
        throw new HttpNotFoundError('Compte introuvable');
    }

    if (user.role === 'ADMIN') {
        const activeAdminCount = await prisma.user.count({
            where: { role: 'ADMIN', deletedAt: null },
        });

        if (activeAdminCount <= 1) {
            throw new HttpBadRequestError('Impossible de supprimer le dernier administrateur');
        }
    }

    await prisma.user.update({
        where: { id: req.user.id },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
    });

    await logAudit(req, 'DELETE_USER', 'CRITICAL', {
        type: 'USER',
        id: user.id,
        label: user.email
    }, { initiatedByUser: true });

    /* Sans accusé, l'adhérent qui exerce son droit à l'effacement n'a aucun
       moyen de savoir si sa demande a abouti — et c'est ce doute-là qui finit en
       réclamation. La date d'effacement vient du job de purge, pas d'un second
       exemplaire du délai. */
    const effaceLe = new Date();
    effaceLe.setDate(effaceLe.getDate() + DELETED_ACCOUNT_RETENTION_DAYS);

    await emailService.sendAccountDeleted(user, { effaceLe });

    res.clearCookie('authToken', { ...cookieOptions, maxAge: undefined });
    res.json({ success: true, message: 'Votre compte a été supprimé.' });
});

// Déconnexion — incrémente tokenVersion pour révoquer immédiatement tous les tokens actifs
const logout = asyncHandler(async (req, res) => {
    if (req.user?.id) {
        await prisma.user.update({
            where: { id: req.user.id },
            data: { tokenVersion: { increment: 1 } },
        });
    }
    res.clearCookie('authToken', { ...cookieOptions, maxAge: undefined });
    res.json({ success: true, message: 'Déconnexion réussie.' });
});

export {
    register,
    login,
    logout,
    getMe,
    exportMe,
    deleteMe,
    confirmEmail,
    resendConfirmationEmail,
    forgotPassword,
    resetPassword
};