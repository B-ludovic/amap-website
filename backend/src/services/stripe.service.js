import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// CRÉER UN PAYMENT INTENT (INTENTION DE PAIEMENT) //
const createPaymentIntent = async (amount, orderId, customerEmail, metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: customerEmail,
      metadata: {
        orderId: orderId.toString(),
        ...metadata
      },
      description: `Commande AMAP - ${orderId}`
    });

    console.log('✅ Payment Intent créé:', paymentIntent.id);
    return paymentIntent;
  } catch (error) {
    console.error('❌ Erreur création Payment Intent:', error);
    throw error;
  }
};

// CRÉER UN REFUND (REMBOURSEMENT) //
const createRefund = async (paymentIntentId, amount = null) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount && { amount: Math.round(amount * 100) }) // Si amount spécifié, sinon rembourse tout
    });

    console.log('✅ Remboursement créé:', refund.id);
    return refund;
  } catch (error) {
    console.error('❌ Erreur remboursement:', error);
    throw error;
  }
};

// RÉCUPÉRER UN PAYMENT INTENT //
const getPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('❌ Erreur récupération Payment Intent:', error);
    throw error;
  }
};

// ANNULER UN PAYMENT INTENT //
const cancelPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    console.log('✅ Payment Intent annulé:', paymentIntent.id);
    return paymentIntent;
  } catch (error) {
    console.error('❌ Erreur annulation Payment Intent:', error);
    throw error;
  }
};

// VÉRIFIER LE STATUT D'UN PAIEMENT //
const verifyPaymentStatus = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      status: paymentIntent.status,
      paymentMethod: paymentIntent.payment_method_types?.[0] || null,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    };
  } catch (error) {
    console.error('❌ Erreur vérification statut paiement:', error);
    throw error;
  }
};

export default {
  createPaymentIntent,
  createRefund,
  getPaymentIntent,
  cancelPaymentIntent,
  verifyPaymentStatus
};

export { createPaymentIntent, createRefund, getPaymentIntent, cancelPaymentIntent, verifyPaymentStatus };