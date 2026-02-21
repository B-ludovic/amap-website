import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import emailService from '../services/email.service.js';
import contractService from '../services/contract.service.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// SOUMETTRE UNE DEMANDE D'ABONNEMENT (UTILISATEUR CONNECTÉ)
export const submitRequest = asyncHandler(async (req, res) => {
  const {
    type,
    basketSize,
    pricingType,
    paymentType,
    message
  } = req.body;

  // L'utilisateur est connecté, on récupère ses infos depuis req.user
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur non trouvé');
  }

  // Validation
  if (!type || !basketSize || !pricingType) {
    throw new HttpBadRequestError('Tous les champs obligatoires doivent être remplis');
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

  if (!paymentType || !['1', '2', '4'].includes(paymentType)) {
    throw new HttpBadRequestError('Modalité de paiement invalide ou non renseignée');
  }

  // Vérifier qu'il n'a pas déjà une demande en attente
  const existingRequest = await prisma.subscriptionRequest.findFirst({
    where: {
      email: user.email,
      status: {
        in: ['PENDING', 'IN_PROGRESS']
      }
    }
  });

  if (existingRequest) {
    throw new HttpConflictError('Vous avez déjà une demande en cours de traitement');
  }

  // Créer la demande avec les infos de l'utilisateur
  const request = await prisma.subscriptionRequest.create({
    data: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      type,
      basketSize,
      pricingType,
      paymentType,
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
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedLimit = Math.min(parseInt(limit) || 20, 100);

  const skip = (parsedPage - 1) * parsedLimit;

  let where = {};

  if (status) {
    where.status = status;
  }

  const [requests, total] = await Promise.all([
    prisma.subscriptionRequest.findMany({
      where,
      skip,
      take: parsedLimit,
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
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
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

  if (!['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(status)) {
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
      processedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : null,
      processedBy: status === 'APPROVED' || status === 'REJECTED' ? req.user.id : null
    }
  });

  res.json({
    success: true,
    message: 'Statut mis à jour avec succès',
    data: updatedRequest
  });
});

// APPROUVER ET CRÉER L'ABONNEMENT (ADMIN)
export const approveAndCreateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminNotes } = req.body;

  // 1. Récupérer la demande
  const request = await prisma.subscriptionRequest.findUnique({
    where: { id }
  });

  if (!request) {
    throw new HttpNotFoundError('Demande d\'abonnement non trouvée');
  }

  if (request.status === 'APPROVED') {
    throw new HttpConflictError('Cette demande a déjà été approuvée');
  }

  // 2. Vérifier si l'utilisateur existe
  let user = await prisma.user.findUnique({
    where: { email: request.email }
  });

  if (!user) {
    throw new HttpNotFoundError('Utilisateur non trouvé. L\'utilisateur doit d\'abord créer un compte.');
  }

  // 3. Vérifier qu'il n'a pas déjà un abonnement actif
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: {
        in: ['ACTIVE', 'PENDING']
      }
    }
  });

  if (existingSubscription) {
    throw new HttpConflictError('Cet utilisateur a déjà un abonnement actif');
  }

  // 4. Calculer les dates et le prix
  const startDate = new Date();
  let endDate = new Date();
  let price = 0;

  if (request.type === 'ANNUAL') {
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    if (request.basketSize === 'SMALL') {
      price = request.pricingType === 'SOLIDARITY' ? 177.60 : 888;
    } else {
      price = request.pricingType === 'SOLIDARITY' ? 278.40 : 1392;
    }
  } else {
    // Découverte : 3 mois
    endDate.setMonth(endDate.getMonth() + 3);
    
    if (request.basketSize === 'SMALL') {
      price = request.pricingType === 'SOLIDARITY' ? 44.40 : 222;
    } else {
      price = request.pricingType === 'SOLIDARITY' ? 69.60 : 348;
    }
  }

  // 5. Générer le numéro d'abonnement
  const year = new Date().getFullYear();
  const count = await prisma.subscription.count({
    where: {
      subscriptionNumber: {
        startsWith: `SUB-${year}-`
      }
    }
  });
  const number = (count + 1).toString().padStart(3, '0');
  const subscriptionNumber = `SUB-${year}-${number}`;

  // 6. Récupérer le point de retrait par défaut
  const pickupLocation = await prisma.pickupLocation.findFirst({
    where: { isActive: true }
  });

  if (!pickupLocation) {
    throw new HttpBadRequestError('Aucun point de retrait actif trouvé');
  }

  // 7. Créer l'abonnement
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      subscriptionNumber,
      type: request.type,
      basketSize: request.basketSize,
      pricingType: request.pricingType,
      status: 'PENDING', // En attente de paiement
      startDate,
      endDate,
      price,
      paidAmount: 0,
      pickupLocationId: pickupLocation.id
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      pickupLocation: true
    }
  });

  // 8. Mettre à jour le statut de la demande
  await prisma.subscriptionRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      adminNotes: adminNotes || '',
      processedAt: new Date(),
      processedBy: req.user.id
    }
  });

  // 9. Envoyer email de confirmation
  await emailService.sendSubscriptionConfirmation(subscription, user);

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Abonnement créé avec succès',
    data: {
      subscription,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    }
  });
});

// GÉNÉRER LE CONTRAT PDF (ADMIN)
export const generateContract = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Récupérer la demande
  const request = await prisma.subscriptionRequest.findUnique({
    where: { id }
  });

  if (!request) {
    throw new HttpNotFoundError('Demande introuvable');
  }

  if (request.status !== 'APPROVED') {
    throw new HttpBadRequestError('Le contrat ne peut être généré que pour les demandes approuvées');
  }

  // 2. Récupérer l'abonnement créé
  const subscription = await prisma.subscription.findFirst({
    where: {
      user: {
        email: request.email
      },
      type: request.type,
      basketSize: request.basketSize
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      pickupLocation: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!subscription) {
    throw new HttpNotFoundError('Aucun abonnement trouvé pour cette demande');
  }

  // 3. Générer le PDF
  const pdfBuffer = await contractService.generateContract(subscription, subscription.user, request.paymentType);

  // 4. Définir les headers pour le téléchargement
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Contrat_${subscription.subscriptionNumber}_${subscription.user.lastName}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader('Cache-Control', 'no-cache');

  // 5. Envoyer le PDF en buffer brut
  res.end(pdfBuffer, 'binary');
});

