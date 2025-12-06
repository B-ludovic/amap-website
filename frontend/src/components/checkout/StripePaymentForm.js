'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { CreditCard, Lock } from 'lucide-react';
import '../../styles/components/stripe-payment-form.css';

export default function StripePaymentForm({ onSuccess, onError, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Confirmer le paiement
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message);
        onError(error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      setErrorMessage('Une erreur est survenue lors du paiement.');
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <div className="payment-form-header">
        <h3 className="payment-form-title">
          <Lock size={20} /> Paiement sécurisé
        </h3>
        <p className="payment-form-amount">
          Montant à payer : <strong>{amount.toFixed(2)}€</strong>
        </p>
      </div>

      <div className="payment-element-container">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="payment-error">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn btn-primary"
      >
        {loading ? (
          'Traitement en cours...'
        ) : (
          <>
            <CreditCard size={20} />
            Payer {amount.toFixed(2)}€
          </>
        )}
      </button>

      <p className="payment-security-note">
        <Lock size={14} /> Paiement 100% sécurisé via Stripe
      </p>
    </form>
  );
}