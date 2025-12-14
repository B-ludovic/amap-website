import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// SOUMETTRE UNE DEMANDE D'ABONNEMENT (USER CONNECTÉ)
export const submitRequest = asyncHandler(async (req, res) => {
  const { type, basketSize, pricingType, message } = req.body;
  
  // Récupérer l'utilisateur connecté
  const userId = req.user.id;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true
    }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur introuvable');
  }

  // Validation
  if (!type || !basketSize || !pricingType) {
    throw new HttpBadRequestError('Type, taille de panier et tarification sont requis');
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

  // Vérifier si l'utilisateur n'a pas déjà une demande en attente
  const existingRequest = await prisma.subscriptionRequest.findFirst({
    where: {
      email: user.email,
      status: { in: ['PENDING', 'IN_PROGRESS'] }
    }
  });

  if (existingRequest) {
    throw new HttpBadRequestError('Vous avez déjà une demande d\'abonnement en cours de traitement');
  }

  const request = await prisma.subscriptionRequest.create({
    data: {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      type,
      basketSize,
      pricingType,
      message: message || '',
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