import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';
// import { sendNewsletterEmail } from '../services/email.service.js';

// RÉCUPÉRER TOUTES LES NEWSLETTERS
const getAllNewsletters = asyncHandler(async (req, res) => {
  const { type, sent, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

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
      take: parseInt(limit),
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
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
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
      content,
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
      content,
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

  // Récupérer les destinataires selon le target
  let recipients = [];

  switch (newsletter.target) {
    case 'ALL':
      recipients = await prisma.user.findMany({
        where: { deletedAt: null },
        select: { email: true, firstName: true }
      });
      break;

    case 'ACTIVE_SUBSCRIBERS':
      const activeSubscriptions = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: { email: true, firstName: true }
          }
        }
      });
      recipients = activeSubscriptions.map(sub => sub.user);
      break;

    case 'SOLIDARITY':
      const solidaritySubscriptions = await prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          pricingType: 'SOLIDARITY'
        },
        include: {
          user: {
            select: { email: true, firstName: true }
          }
        }
      });
      recipients = solidaritySubscriptions.map(sub => sub.user);
      break;

    case 'TEST':
      recipients = [{
        email: req.user.email,
        firstName: req.user.firstName
      }];
      break;
  }

  // TODO: Envoyer les emails
  // for (const recipient of recipients) {
  //   await sendNewsletterEmail(recipient, newsletter);
  // }

  // Mettre à jour la newsletter
  await prisma.newsletter.update({
    where: { id },
    data: {
      sentAt: new Date(),
      sentCount: recipients.length
    }
  });

  res.json({
    success: true,
    message: `Newsletter envoyée à ${recipients.length} destinataire(s)`,
    data: {
      sentCount: recipients.length
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