import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { normalizeFirstName, normalizeLastName, normalizeTitleCase } from '../utils/normalize.js';
import { logAudit } from '../services/audit.service.js';
import { ProducerInquirySchema } from '../utils/validation.schemas.js';

// SOUMETTRE UNE DEMANDE (PUBLIC)
const submitInquiry = asyncHandler(async (req, res) => {
  const parsed = ProducerInquirySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpBadRequestError(parsed.error.issues[0].message);
  }
  const { firstName, lastName, farmName, address, city, ...reste } = parsed.data;

  const inquiry = await prisma.producerInquiry.create({
    data: {
      ...reste,
      firstName: normalizeFirstName(firstName),
      lastName: normalizeLastName(lastName),
      farmName: normalizeTitleCase(farmName),
      address: normalizeTitleCase(address),
      city: normalizeTitleCase(city)
    }
  });

  // Envoyer email de confirmation au producteur
  await emailService.sendProducerInquiryConfirmation(inquiry);

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Votre demande a été envoyée avec succès. Nous vous recontacterons rapidement.',
    data: inquiry
  });
});

// RÉCUPÉRER TOUTES LES DEMANDES (ADMIN)
const getAllInquiries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  const [inquiries, total] = await Promise.all([
    prisma.producerInquiry.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.producerInquiry.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      inquiries,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    }
  });
});

// RÉCUPÉRER UNE DEMANDE (ADMIN)
const getInquiryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inquiry = await prisma.producerInquiry.findUnique({
    where: { id }
  });

  if (!inquiry) {
    throw new HttpNotFoundError('Demande introuvable');
  }

  res.json({
    success: true,
    data: inquiry
  });
});

// METTRE À JOUR LE STATUT (ADMIN)
const updateInquiryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, createProducer } = req.body;

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'ARCHIVED'];

  if (!status || !validStatuses.includes(status)) {
    throw new HttpBadRequestError(`Statut invalide. Valeurs autorisées : ${validStatuses.join(', ')}`);
  }

  const inquiry = await prisma.producerInquiry.findUnique({
    where: { id }
  });

  if (!inquiry) {
    throw new HttpNotFoundError('Demande introuvable');
  }

  /* Création du producteur à l'acceptation. L'email d'un producteur est unique
     en base : accepter deux fois la même candidature ferait remonter une
     violation de contrainte brute. On regarde d'abord si la ferme est déjà
     enregistrée, auquel cas on la réutilise au lieu d'en créer un doublon. */
  let newProducer = null;

  if (status === 'ACCEPTED' && createProducer) {
    const existingProducer = await prisma.producer.findUnique({
      where: { email: inquiry.email }
    });

    newProducer = existingProducer ?? await prisma.producer.create({
      data: {
        name: inquiry.farmName,
        email: inquiry.email,
        phone: inquiry.phone,
        specialty: inquiry.products,
        description: inquiry.message,
        isActive: true
      }
    });
  }

  /* Le tampon de réponse se pose une seule fois, à la première décision.
     Enregistrer une note ou repasser la candidature à l'étude ne doit pas
     réécrire la date ni la main qui a répondu. */
  const isAnswered = status === 'ACCEPTED' || status === 'REJECTED';

  const updated = await prisma.producerInquiry.update({
    where: { id },
    data: {
      status,
      adminNotes: adminNotes ?? inquiry.adminNotes,
      respondedAt: isAnswered ? (inquiry.respondedAt ?? new Date()) : null,
      respondedBy: isAnswered ? (inquiry.respondedBy ?? req.user.id) : null
    }
  });

  /* L'email ne part qu'au changement d'état. Sans cette garde, enregistrer une
     note sur une candidature déjà acceptée renverrait la réponse au producteur
     à chaque enregistrement. */
  if (inquiry.status !== status) {
    if (status === 'ACCEPTED') {
      await emailService.sendProducerInquiryAccepted(inquiry);
    } else if (status === 'REJECTED') {
      await emailService.sendProducerInquiryRejected(inquiry);
    }
  }

  res.json({
    success: true,
    message: 'Statut mis à jour avec succès',
    data: {
      inquiry: updated,
      producer: newProducer
    }
  });
});

// SUPPRIMER UNE DEMANDE (ADMIN)
const deleteInquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inquiry = await prisma.producerInquiry.findUnique({
    where: { id }
  });

  if (!inquiry) {
    throw new HttpNotFoundError('Demande introuvable');
  }

  await prisma.producerInquiry.delete({ where: { id } });

  /* Destruction définitive de l'identité, du téléphone et de l'adresse d'une
     exploitation, sans passer par la purge automatique ni par un quelconque
     délai. Le journal garde ce qu'il faut pour répondre « qui, quand, laquelle »
     sans reconstituer les données effacées : la ferme et le statut suffisent. */
  await logAudit(req, 'DELETE_PRODUCER_INQUIRY', 'IMPORTANT', { type: 'PRODUCER_INQUIRY', id, label: inquiry.farmName }, { status: inquiry.status, submittedAt: inquiry.createdAt });

  res.json({
    success: true,
    message: 'Demande supprimée avec succès'
  });
});

export {
  submitInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
  deleteInquiry
};