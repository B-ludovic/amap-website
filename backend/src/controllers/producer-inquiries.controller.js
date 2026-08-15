import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import { z } from 'zod';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { normalizeFirstName, normalizeLastName, normalizeTitleCase } from '../utils/normalize.js';
import { logAudit } from '../services/audit.service.js';

// SOUMETTRE UNE DEMANDE (PUBLIC)
const submitInquiry = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    farmName,
    address,
    city,
    postalCode,
    distance,
    products,
    isBio,
    certifications,
    message,
    availability
  } = req.body;

  // Validation présence
  if (!firstName || !lastName || !email || !phone || !farmName || !address || !city || !postalCode || !products) {
    throw new HttpBadRequestError('Tous les champs obligatoires doivent être remplis');
  }

  // Validation longueurs
  if (firstName.length > 100) throw new HttpBadRequestError('Prénom : 100 caractères maximum.');
  if (lastName.length > 100) throw new HttpBadRequestError('Nom : 100 caractères maximum.');
  if (farmName.length > 200) throw new HttpBadRequestError('Nom de l\'exploitation : 200 caractères maximum.');
  if (address.length > 255) throw new HttpBadRequestError('Adresse : 255 caractères maximum.');
  if (city.length > 100) throw new HttpBadRequestError('Ville : 100 caractères maximum.');
  if (message && message.length > 2000) throw new HttpBadRequestError('Message : 2000 caractères maximum.');

  if (!z.string().email().safeParse(email).success) {
    throw new HttpBadRequestError('Email invalide');
  }

  if (!/^\d{5}$/.test(postalCode)) {
    throw new HttpBadRequestError('Code postal invalide (5 chiffres requis).');
  }

  const inquiry = await prisma.producerInquiry.create({
    data: {
      firstName: normalizeFirstName(firstName),
      lastName: normalizeLastName(lastName),
      email,
      phone,
      farmName: normalizeTitleCase(farmName),
      address: normalizeTitleCase(address),
      city: normalizeTitleCase(city),
      postalCode,
      distance,
      products,
      isBio: isBio || false,
      certifications,
      message,
      availability
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