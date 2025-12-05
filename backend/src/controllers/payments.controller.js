import { prisma } from '../config/database.js';
import { asyncHandler } from '../middlewares/error.middleware.js';
import {
  HttpNotFoundError,
  HttpBadRequestError,
  HttpForbiddenError,
  HttpConflictError,
  httpStatusCodes
} from '../utils/httpErrors.js';
import { 
  createPaymentIntent as createStripePaymentIntent,
  verifyPaymentStatus
} from '../services/stripe.service.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// CRÉER UN PAYMENT INTENT 
const createPaymentIntent = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user.id;

  if (!orderId) {
    throw new HttpBadRequestError('ID de commande requis');
  }

  // Récupérer la commande
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!order) {
    throw new HttpNotFoundError('Commande introuvable');
  }

  // Vérifier que la commande appartient à l'utilisateur
  if (order.userId !== userId) {
    throw new HttpForbiddenError('Cette commande ne vous appartient pas');
  }

  // Vérifier que la commande est en attente de paiement
  if (order.status !== 'PENDING') {
    throw new HttpConflictError(
      `Cette commande ne peut pas être payée. Statut actuel : ${order.status}`
    );
  }

  // Créer le Payment Intent via le service Stripe
  const paymentIntent = await createStripePaymentIntent(
    order.totalAmount,
    order.orderNumber,
    order.user.email,
    {
      userId: userId,
      orderId: order.id
    }
  );

  // Mettre à jour la commande avec le Payment Intent ID
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentIntentId: paymentIntent.id
    }
  });

  // Créer une entrée Payment dans notre base
  await prisma.payment.create({
    data: {
      orderId: order.id,
      amount: order.totalAmount,
      status: 'PENDING',
      stripePaymentId: paymentIntent.id,
      paymentMethod: null // Sera mis à jour après paiement
    }
  });

  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret, // À envoyer au frontend
      paymentIntentId: paymentIntent.id
    }
  });
});

// CONFIRMER UN PAIEMENT 
const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;
  const userId = req.user.id;

  if (!paymentIntentId) {
    throw new HttpBadRequestError('Payment Intent ID requis');
  }

  // Vérifier le statut via le service Stripe
  const paymentStatus = await verifyPaymentStatus(paymentIntentId);

  // Récupérer la commande
  const order = await prisma.order.findFirst({
    where: {
      paymentIntentId: paymentIntentId
    }
  });

  if (!order) {
    throw new HttpNotFoundError('Commande introuvable');
  }

  // Vérifier que la commande appartient à l'utilisateur
  if (order.userId !== userId) {
    throw new HttpForbiddenError('Cette commande ne vous appartient pas');
  }

  // Vérifier le statut du paiement
  if (paymentStatus.status === 'succeeded') {
    // Mettre à jour la commande et le paiement dans une transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Mettre à jour le statut de la commande
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID'
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

      // Mettre à jour le paiement
      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          stripePaymentId: paymentIntentId
        },
        data: {
          status: 'SUCCEEDED',
          paymentMethod: paymentStatus.paymentMethod || 'card'
        }
      });

      return updated;
    });

    // TODO: Envoyer un email de confirmation de paiement
    // import { sendPaymentConfirmationEmail } from '../services/email.service.js';
    // await sendPaymentConfirmationEmail(updatedOrder, req.user);

    res.json({
      success: true,
      message: 'Paiement confirmé avec succès',
      data: { order: updatedOrder }
    });
  } else {
    // Le paiement n'a pas réussi
    await prisma.payment.updateMany({
      where: {
        orderId: order.id,
        stripePaymentId: paymentIntentId
      },
      data: {
        status: 'FAILED'
      }
    });

    throw new HttpBadRequestError(
      `Le paiement n'a pas abouti. Statut : ${paymentStatus.status}`
    );
  }
});

// WEBHOOK STRIPE 
// Important : cette route reçoit les événements de Stripe
const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Vérifier que le webhook vient bien de Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Erreur webhook Stripe:', err.message);
    return res.status(httpStatusCodes.BAD_REQUEST).send(`Webhook Error: ${err.message}`);
  }

  // Gérer les différents types d'événements
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Mettre à jour la commande
      const order = await prisma.order.findFirst({
        where: { paymentIntentId: paymentIntent.id }
      });

      if (order) {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAID' }
          });

          await tx.payment.updateMany({
            where: {
              orderId: order.id,
              stripePaymentId: paymentIntent.id
            },
            data: {
              status: 'SUCCEEDED',
              paymentMethod: paymentIntent.payment_method_types[0] || 'card'
            }
          });
        });

        console.log(`✅ Paiement réussi pour la commande ${order.orderNumber}`);
        // TODO: Envoyer email de confirmation
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      
      const failedOrder = await prisma.order.findFirst({
        where: { paymentIntentId: failedPayment.id }
      });

      if (failedOrder) {
        await prisma.payment.updateMany({
          where: {
            orderId: failedOrder.id,
            stripePaymentId: failedPayment.id
          },
          data: { status: 'FAILED' }
        });

        console.log(`❌ Paiement échoué pour la commande ${failedOrder.orderNumber}`);
        // TODO: Envoyer email d'échec
      }
      break;

    default:
      console.log(`⚠️ Événement non géré : ${event.type}`);
  }

  // Toujours renvoyer 200 à Stripe pour confirmer la réception
  res.json({ received: true });
});

export { createPaymentIntent, confirmPayment, handleWebhook };