import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpConflictError,
  HttpForbiddenError,
  httpStatusCodes
} from '../utils/httpErrors.js';

// Fonction helper pour générer un numéro de commande unique
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AMAP-${timestamp}-${random}`;
};

// CRÉER UNE COMMANDE 
const createOrder = asyncHandler(async (req, res) => {
  const { items, pickupLocationId, pickupDate } = req.body;
  const userId = req.user.id;

  // Vérifier que les champs sont remplis
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpBadRequestError('Aucun panier sélectionné');
  }

  if (!pickupLocationId || !pickupDate) {
    throw new HttpBadRequestError('Point de retrait et date de retrait requis');
  }

  // Vérifier que la date est valide
  const pickupDateObj = new Date(pickupDate);
  if (isNaN(pickupDateObj.getTime())) {
    throw new HttpBadRequestError('Format de date invalide');
  }

  // Vérifier que le point de retrait existe
  const pickupLocation = await prisma.pickupLocation.findUnique({
    where: { id: pickupLocationId }
  });

  if (!pickupLocation || !pickupLocation.isActive) {
    throw new HttpNotFoundError('Point de retrait introuvable ou inactif');
  }

  // Calculer le montant total et vérifier les stocks
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const { basketAvailabilityId, quantity } = item;

    if (!basketAvailabilityId || !quantity || quantity <= 0) {
      throw new HttpBadRequestError('Données de panier invalides');
    }

    // Récupérer la disponibilité du panier
    const availability = await prisma.basketAvailability.findUnique({
      where: { id: basketAvailabilityId },
      include: {
        basketType: true
      }
    });

    if (!availability) {
      throw new HttpNotFoundError(`Disponibilité de panier introuvable`);
    }

    // Vérifier le stock disponible
    if (availability.availableQuantity < quantity) {
      throw new HttpConflictError(
        `Stock insuffisant pour ${availability.basketType.name}. ` +
        `Disponible : ${availability.availableQuantity}, demandé : ${quantity}`
      );
    }

    // Vérifier que le panier est actif
    if (!availability.basketType.isActive) {
      throw new HttpBadRequestError(`Le panier ${availability.basketType.name} n'est plus disponible`);
    }

    // Calculer le prix
    const itemPrice = availability.basketType.price * quantity;
    totalAmount += itemPrice;

    orderItems.push({
      basketAvailabilityId,
      quantity,
      priceAtOrder: availability.basketType.price
    });
  }

  // Générer un numéro de commande unique
  const orderNumber = generateOrderNumber();

  // Créer la commande avec les items dans une transaction
  // (pour éviter les problèmes si une étape échoue)
  const order = await prisma.$transaction(async (tx) => {
    // Créer la commande
    const newOrder = await tx.order.create({
      data: {
        userId,
        orderNumber,
        status: 'PENDING',
        totalAmount,
        pickupLocationId,
        pickupDate: pickupDateObj,
        orderItems: {
          create: orderItems
        }
      },
      include: {
        orderItems: {
          include: {
            basketAvailability: {
              include: {
                basketType: true,
                pickupLocation: true
              }
            }
          }
        },
        pickupLocation: true
      }
    });

    // Déduire les quantités du stock
    for (const item of items) {
      await tx.basketAvailability.update({
        where: { id: item.basketAvailabilityId },
        data: {
          availableQuantity: {
            decrement: item.quantity
          }
        }
      });
    }

    return newOrder;
  });

  // TODO: Envoyer un email de confirmation

  res.status(httpStatusCodes.CREATED).json({
    success: true,
    message: 'Commande créée avec succès',
    data: { order }
  });
});

// RÉCUPÉRER MES COMMANDES
const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      orderItems: {
        include: {
          basketAvailability: {
            include: {
              basketType: true
            }
          }
        }
      },
      pickupLocation: true
    },
    orderBy: {
      createdAt: 'desc' // Les plus récentes en premier
    }
  });

  res.json({
    success: true,
    data: {
      orders,
      count: orders.length
    }
  });
});

// RÉCUPÉRER UNE COMMANDE SPÉCIFIQUE
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: {
        include: {
          basketAvailability: {
            include: {
              basketType: {
                include: {
                  products: {
                    include: {
                      product: {
                        include: {
                          producer: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      pickupLocation: true,
      payments: true
    }
  });

  if (!order) {
    throw new HttpNotFoundError('Commande introuvable');
  }

  // Vérifier que la commande appartient bien à l'utilisateur
  // (sauf si c'est un admin)
  if (order.userId !== userId && req.user.role !== 'ADMIN') {
    throw new HttpForbiddenError('Vous n\'avez pas accès à cette commande');
  }

  res.json({
    success: true,
    data: { order }
  });
});

// ANNULER UNE COMMANDE
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      orderItems: true
    }
  });

  if (!order) {
    throw new HttpNotFoundError('Commande introuvable');
  }

  // Vérifier que la commande appartient à l'utilisateur
  if (order.userId !== userId && req.user.role !== 'ADMIN') {
    throw new HttpForbiddenError('Vous ne pouvez pas annuler cette commande');
  }

  // On ne peut annuler que les commandes en attente ou payées
  if (!['PENDING', 'PAID'].includes(order.status)) {
    throw new HttpBadRequestError('Cette commande ne peut plus être annulée');
  }

  // Annuler la commande et remettre le stock dans une transaction
  const cancelledOrder = await prisma.$transaction(async (tx) => {
    // Mettre à jour le statut de la commande
    const updated = await tx.order.update({
      where: { id },
      data: {
        status: 'CANCELLED'
      },
      include: {
        orderItems: {
          include: {
            basketAvailability: {
              include: {
                basketType: true
              }
            }
          }
        },
        pickupLocation: true
      }
    });

    // Remettre les quantités dans le stock
    for (const item of order.orderItems) {
      await tx.basketAvailability.update({
        where: { id: item.basketAvailabilityId },
        data: {
          availableQuantity: {
            increment: item.quantity
          }
        }
      });
    }

    return updated;
  });

  // TODO: Envoyer un email d'annulation
  // TODO: Si la commande était payée, créer un remboursement Stripe

  res.json({
    success: true,
    message: 'Commande annulée avec succès',
    data: { order: cancelledOrder }
  });
});

export { createOrder, getMyOrders, getOrderById, cancelOrder };