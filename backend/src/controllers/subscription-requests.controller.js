import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// SOUMETTRE UNE DEMANDE D'ABONNEMENT (PUBLIC)
export const submitRequest = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    type,
    basketSize,
    pricingType,
    message
  } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !phone || !type || !basketSize || !pricingType) {
    throw new HttpBadRequestError('Tous les champs obligatoires doivent être remplis');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpBadRequestError('Email invalide');
  }

  if (!['ANNUAL', 'DISCOVERY'].includes(type)) {
    throw new HttpBadRequestError('Type d\'abonnement invalide');
  }

  if (!['SMALL', 'LARGE'].includes(basketSize)) {
    throw new HttpBadRequestError('Taille de panier invalide');
  }

  if (!['NORMAL', 'SOLIDARITY'].includes(pricingType)) {
    throw new HttpBadRequestError('Type de tarification invalide');
  }

  const request = await prisma.subscriptionRequest.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      type,
      basketSize,
      pricingType,
      message,
      status: 'PENDING'
    }
  });

  // Envoyer email de confirmation
  await emailService.sendSubscriptionRequestConfirmation(request);

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Votre demande d\'abonnement a été envoyée avec succès. Nous vous recontacterons rapidement.',
    data: request
  });
});

// RÉCUPÉRER TOUTES LES DEMANDES (ADMIN)
export const getAllRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let where = {};

  if (status) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.subscriptionRequest.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

// RÉCUPÉRER UNE DEMANDE PAR ID (ADMIN)
export const getRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await prisma.subscriptionRequest.findUnique({
    where: { id }
  });

  if (!request) {
    throw new HttpNotFoundError('Demande d\'abonnement non trouvée');
  }

  res.json({
    success: true,
    data: request
  });
});

// METTRE À JOUR LE STATUT (ADMIN)
export const updateRequestStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  if (!status) {
    throw new HttpBadRequestError('Le statut est requis');
  }

  if (!['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'].includes(status)) {
    throw new HttpBadRequestError('Statut invalide');
  }

  const request = await prisma.subscriptionRequest.findUnique({
    where: { id }
  });

  if (!request) {
    throw new HttpNotFoundError('Demande d\'abonnement non trouvée');
  }

  const updatedRequest = await prisma.subscriptionRequest.update({
    where: { id },
    data: {
      status,
      adminNotes: adminNotes || request.adminNotes,
      processedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : null
    }
  });

  // TODO: Envoyer email selon le statut (APPROVED ou REJECTED)
  // if (status === 'APPROVED') {
  //   await emailService.sendSubscriptionApproved(request);
  // } else if (status === 'REJECTED') {
  //   await emailService.sendSubscriptionRejected(request);
  // }

  res.json({
    success: true,
    message: 'Statut mis à jour avec succès',
    data: updatedRequest
  });
});