import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';

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

  // Validation
  if (!firstName || !lastName || !email || !phone || !farmName || !address || !city || !postalCode || !products) {
    throw new HttpBadRequestError('Tous les champs obligatoires doivent être remplis');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpBadRequestError('Email invalide');
  }

  const inquiry = await prisma.producerInquiry.create({
    data: {
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

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let where = {};

  if (status) {
    where.status = status;
  }

  const [inquiries, total] = await Promise.all([
    prisma.producerInquiry.findMany({
      where,
      skip,
      take: parseInt(limit),
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
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
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

  // Si accepté ET createProducer = true, créer le producteur
  let newProducer = null;

  if (status === 'ACCEPTED' && createProducer) {
    newProducer = await prisma.producer.create({
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

  const updated = await prisma.producerInquiry.update({
    where: { id },
    data: {
      status,
      adminNotes,
      respondedAt: new Date(),
      respondedBy: req.user.id
    }
  });

  // TODO: Envoyer email au producteur selon le statut

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