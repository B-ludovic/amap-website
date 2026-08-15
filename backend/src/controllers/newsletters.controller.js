import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
    HttpNotFoundError,
    HttpBadRequestError,
    HttpConflictError,
    httpStatusCodes
} from '../utils/httpErrors.js';
import { logAudit } from '../services/audit.service.js';
import { resolveNewsletterRecipients } from '../services/newsletterAudience.service.js';

// RÉCUPÉRER TOUTES LES NEWSLETTERS
const getAllNewsletters = asyncHandler(async (req, res) => {
    const { type, sent, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(parseInt(limit) || 20, 100);

    const skip = (parsedPage - 1) * parsedLimit;

    let where = {};

    if (type) {
        where.type = type;
    }

    if (sent === 'true') {
        where.sentAt = { not: null };
    } else if (sent === 'false') {
        where.sentAt = null;
    }

    const [newsletters, total] = await Promise.all([
        prisma.newsletter.findMany({
            where,
            skip,
            take: parsedLimit,
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        }),
        prisma.newsletter.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            newsletters,
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit)
            }
        }
    });
});

// RÉCUPÉRER UNE NEWSLETTER
const getNewsletterById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const newsletter = await prisma.newsletter.findUnique({
        where: { id },
        include: {
            author: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            }
        }
    });

    if (!newsletter) {
        throw new HttpNotFoundError('Newsletter introuvable');
    }

    res.json({
        success: true,
        data: newsletter
    });
});

// CRÉER UNE NEWSLETTER
const createNewsletter = asyncHandler(async (req, res) => {
    const { subject, content, type, target } = req.body;
    const createdBy = req.user.id;

    if (!subject || !content) {
        throw new HttpBadRequestError('Sujet et contenu requis');
    }

    const newsletter = await prisma.newsletter.create({
        data: {
            subject,
            content: DOMPurify.sanitize(content),
            type: type || 'GENERAL',
            target: target || 'ALL',
            createdBy
        },
        include: {
            author: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            }
        }
    });

    res.status(httpStatusCodes.CREATED).json({
        success: true,
        message: 'Newsletter créée avec succès',
        data: newsletter
    });
});

// MODIFIER UNE NEWSLETTER
const updateNewsletter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { subject, content, type, target } = req.body;

    const newsletter = await prisma.newsletter.findUnique({ where: { id } });

    if (!newsletter) {
        throw new HttpNotFoundError('Newsletter introuvable');
    }

    if (newsletter.sentAt) {
        throw new HttpConflictError('Impossible de modifier une newsletter déjà envoyée');
    }

    const updated = await prisma.newsletter.update({
        where: { id },
        data: {
            subject,
            content: content ? DOMPurify.sanitize(content) : undefined,
            type,
            target
        },
        include: {
            author: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            }
        }
    });

    res.json({
        success: true,
        message: 'Newsletter modifiée avec succès',
        data: updated
    });
});

// SUPPRIMER UNE NEWSLETTER
const deleteNewsletter = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const newsletter = await prisma.newsletter.findUnique({ where: { id } });

    if (!newsletter) {
        throw new HttpNotFoundError('Newsletter introuvable');
    }

    if (newsletter.sentAt) {
        throw new HttpConflictError('Impossible de supprimer une newsletter déjà envoyée');
    }

    await prisma.newsletter.delete({ where: { id } });

    await logAudit(req, 'DELETE_NEWSLETTER', 'IMPORTANT', { type: 'NEWSLETTER', id, label: newsletter.subject }, { type: newsletter.type, target: newsletter.target, scheduledFor: newsletter.scheduledFor });

    res.json({
        success: true,
        message: 'Newsletter supprimée avec succès'
    });
});

// ENVOYER UNE NEWSLETTER
const sendNewsletter = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const newsletter = await prisma.newsletter.findUnique({ where: { id } });

    if (!newsletter) {
        throw new HttpNotFoundError('Newsletter introuvable');
    }

    if (newsletter.sentAt) {
        throw new HttpConflictError('Cette newsletter a déjà été envoyée');
    }

    /* Qui reçoit : la règle vit dans newsletterAudience, partagée avec l'annonce
       automatique de fermeture, pour qu'un désabonnement respecté ici le soit
       aussi là-bas. L'envoi de test fait exception — il ne s'adresse qu'à
       l'administrateur qui appuie sur le bouton, et doit partir même si celui-ci
       s'est désabonné, sinon il ne pourrait plus se relire. */
    const recipients = newsletter.target === 'TEST'
        ? [{ id: req.user.id, email: req.user.email, firstName: req.user.firstName }]
        : await resolveNewsletterRecipients({ target: newsletter.target, type: newsletter.type });

    // Envoyer les emails via le service
    const result = await emailService.sendNewsletter(newsletter, recipients);

    if (!result.success) {
        throw new HttpBadRequestError('Erreur lors de l\'envoi de la newsletter');
    }

    const { sent, failed } = result.results;

    /* Un envoi qui n'a atteint personne n'est pas un envoi.

       La garde !result.success au-dessus ne se déclenche que si la méthode
       elle-même s'est effondrée ; les refus du serveur SMTP, eux, sont comptés
       destinataire par destinataire et rendus dans results. Sans la condition
       ci-dessous, un quota Brevo dépassé un jour de rentrée donnait ceci :
       cent vingt refus, sentAt posé quand même, « Newsletter envoyée à 0
       destinataire(s) » à l'écran, et un second clic accueilli par « cette
       newsletter a déjà été envoyée ». Le texte mourait en base, lu par
       personne, et le seul chemin de sortie était de le recopier ailleurs.

       Ne pas poser sentAt est tout l'enjeu : c'est lui, et lui seul, qui
       verrouille. Tant qu'il reste nul, la newsletter se corrige et se renvoie
       une fois le quota revenu. */
    if (sent === 0 && recipients.length > 0) {
        /* Le détail par destinataire vit dans EmailLog, pas ici : recopier les
           adresses dans les logs de l'hébergeur reviendrait sur la règle posée
           pour error.middleware.js. */
        console.error(`[Newsletter ${id}] échec total : ${failed} envoi(s) refusé(s) sur ${recipients.length} — voir EmailLog`);

        throw new HttpBadRequestError(
            `Aucun email n'a pu être envoyé (${failed} échec${failed > 1 ? 's' : ''}). La newsletter reste modifiable et renvoyable.`
        );
    }

    // Mettre à jour la newsletter
    await prisma.newsletter.update({
        where: { id },
        data: {
            sentAt: new Date(),
            sentCount: sent
        }
    });

    /* Succès partiel : la newsletter est bien partie, elle se verrouille donc,
       mais quelques boîtes n'ont pas été atteintes. On le dit plutôt que de
       laisser l'administratrice déduire l'écart entre deux nombres. */
    if (failed > 0) {
        console.warn(`[Newsletter ${id}] ${failed} destinataire(s) non joint(s) sur ${recipients.length} — voir EmailLog`);
    }

    /* Qui a écrit à tout le monde, quand, à quelle liste et combien de boîtes ont
       reçu le message. Newsletter.createdBy ne répond qu'à la première question,
       et encore : il nomme la main qui a rédigé, pas celle qui a appuyé sur
       « envoyer », et il devient nul lorsque le compte de l'auteur est purgé.
       Le journal, lui, conserve l'adresse de l'administrateur telle qu'elle était
       au moment de l'envoi. */
    await logAudit(req, 'SEND_NEWSLETTER', 'CRITICAL', { type: 'NEWSLETTER', id, label: newsletter.subject }, { target: newsletter.target, recipientsCount: recipients.length, sentCount: sent, failedCount: failed });

    res.json({
        success: true,
        message: failed > 0
            ? `Newsletter envoyée à ${sent} destinataire(s), ${failed} non joint(s).`
            : `Newsletter envoyée à ${sent} destinataire(s)`,
        data: {
            sentCount: sent,
            failedCount: failed
        }
    });
});

// PROGRAMMER UNE NEWSLETTER
const scheduleNewsletter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { scheduledFor } = req.body;

    if (!scheduledFor) {
        throw new HttpBadRequestError('Date de programmation requise');
    }

    const newsletter = await prisma.newsletter.findUnique({ where: { id } });

    if (!newsletter) {
        throw new HttpNotFoundError('Newsletter introuvable');
    }

    if (newsletter.sentAt) {
        throw new HttpConflictError('Cette newsletter a déjà été envoyée');
    }

    const scheduledDate = new Date(scheduledFor);

    if (scheduledDate <= new Date()) {
        throw new HttpBadRequestError('La date doit être dans le futur');
    }

    await prisma.newsletter.update({
        where: { id },
        data: {
            scheduledFor: scheduledDate
        }
    });

    res.json({
        success: true,
        message: 'Newsletter programmée avec succès'
    });
});

// STATISTIQUES
const getNewsletterStats = asyncHandler(async (req, res) => {
    const [total, sent, scheduled, byType] = await Promise.all([
        prisma.newsletter.count(),
        prisma.newsletter.count({ where: { sentAt: { not: null } } }),
        prisma.newsletter.count({
            where: {
                scheduledFor: { not: null },
                sentAt: null
            }
        }),
        prisma.newsletter.groupBy({
            by: ['type'],
            _count: true
        })
    ]);

    res.json({
        success: true,
        data: {
            total,
            sent,
            scheduled,
            draft: total - sent - scheduled,
            byType
        }
    });
});

export {
    getAllNewsletters,
    getNewsletterById,
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    sendNewsletter,
    scheduleNewsletter,
    getNewsletterStats
};