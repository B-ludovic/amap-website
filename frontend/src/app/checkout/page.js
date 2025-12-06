'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripePaymentForm from '../../components/checkout/StripePaymentForm';
import Image from 'next/image';
import { MapPin, Calendar } from 'lucide-react';

// Charger Stripe avec la clé publique
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY);

function CheckoutPage() {
  const router = useRouter();
  const { cart, getTotal, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    // Vérifier l'authentification
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    // Vérifier que le panier n'est pas vide
    if (user && cart.length === 0) {
      router.push('/panier');
      return;
    }

    // Créer la commande et le Payment Intent
    if (user && cart.length > 0) {
      createOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, router, user, authLoading]);

  const createOrder = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Préparer les items pour la commande
      const orderItems = cart.map(item => ({
        basketAvailabilityId: item.availabilityId,
        quantity: item.quantity
      }));

      // TODO: Appeler l'API réelle pour créer la commande
      // const response = await fetch('http://localhost:4000/api/orders', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({
      //     items: orderItems,
      //     pickupLocationId: cart[0].pickupLocation.id,
      //     pickupDate: cart[0].distributionDate
      //   })
      // });

      // const orderData = await response.json();

      // Simulation
      setTimeout(() => {
        const mockOrderId = 'ORDER-' + Date.now();
        setOrderId(mockOrderId);

        // Créer le Payment Intent
        createPaymentIntent(mockOrderId);
      }, 1000);

    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      showError(
        'Erreur de commande',
        'Une erreur est survenue lors de la création de la commande. Veuillez réessayer.'
      );
      setLoading(false);
    }
  };

  const createPaymentIntent = async (orderId) => {
    try {
      const token = localStorage.getItem('token');

      // TODO: Appeler l'API réelle pour créer le Payment Intent
      // const response = await fetch('http://localhost:4000/api/payments/create-payment-intent', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({
      //     orderId: orderId
      //   })
      // });

      // const data = await response.json();
      // setClientSecret(data.data.clientSecret);

      // Simulation (en prod, tu recevras le vrai clientSecret de l'API)
      setTimeout(() => {
        // Pour tester, utilise un vrai Payment Intent de ton compte Stripe test
        setClientSecret('pi_test_secret_simulation');
        setLoading(false);
      }, 500);

    } catch (error) {
      console.error('Erreur lors de la création du Payment Intent:', error);
      showError(
        'Erreur de paiement',
        'Une erreur est survenue lors de la préparation du paiement. Veuillez réessayer.'
      );
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntent) => {
    try {
      const token = localStorage.getItem('token');

      // TODO: Confirmer le paiement côté serveur
      // await fetch('http://localhost:4000/api/payments/confirm', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({
      //     paymentIntentId: paymentIntent.id
      //   })
      // });

      // Vider le panier
      clearCart();

      // Rediriger vers la page de confirmation
      router.push('/checkout/success');
    } catch (error) {
      console.error('Erreur lors de la confirmation du paiement:', error);
      showError(
        'Erreur de confirmation',
        'Le paiement a réussi mais une erreur est survenue. Veuillez contacter le support.'
      );
    }
  };

  const handlePaymentError = (error) => {
    console.error('Erreur de paiement:', error);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="checkout-page">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Le useEffect va rediriger
  }

  // Options pour Stripe Elements
  const stripeOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#c85a3f',
        colorBackground: '#ffffff',
        colorText: '#2d3748',
        colorDanger: '#f87171',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        borderRadius: '8px',
      },
    },
  };

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="page-title">Finaliser ma commande</h1>

        <div className="checkout-content">
          {/* Formulaire */}
          <div className="checkout-main">
            {/* Informations personnelles */}
            <div className="checkout-section">
              <h2 className="checkout-section-title">Vos informations</h2>
              <div className="checkout-info-card">
                <div className="checkout-info-row">
                  <span className="checkout-info-label">Nom</span>
                  <span className="checkout-info-value">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
                <div className="checkout-info-row">
                  <span className="checkout-info-label">Email</span>
                  <span className="checkout-info-value">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="checkout-info-row">
                    <span className="checkout-info-label">Téléphone</span>
                    <span className="checkout-info-value">{user.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Points de retrait */}
            <div className="checkout-section">
              <h2 className="checkout-section-title">Points de retrait</h2>
              <div className="checkout-pickups">
                {/* Grouper par point de retrait et date */}
                {Object.values(
                  cart.reduce((acc, item) => {
                    // Protection si pickupLocation manquant
                    if (!item.pickupLocation) return acc;
                    
                    const key = `${item.pickupLocation.id}-${item.distributionDate}`;
                    if (!acc[key]) {
                      acc[key] = {
                        location: item.pickupLocation,
                        date: item.distributionDate,
                        items: []
                      };
                    }
                    acc[key].items.push(item);
                    return acc;
                  }, {})
                ).map((pickup, index) => (
                  <div key={index} className="checkout-pickup-card">
                    <div className="checkout-pickup-header">
                      <h3 className="checkout-pickup-location">
                        <MapPin size={20} />
                        {pickup.location.name}
                      </h3>
                      <p className="checkout-pickup-date">
                        <Calendar size={20} />
                        {formatDate(pickup.date)}
                      </p>
                    </div>
                    <p className="checkout-pickup-address">
                      {pickup.location.address}
                    </p>
                    <div className="checkout-pickup-items">
                      {pickup.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="checkout-pickup-item">
                          {item.quantity}x {item.basketName}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paiement Stripe */}
            {clientSecret && (
              <div className="checkout-section">
                <Elements stripe={stripePromise} options={stripeOptions}>
                  <StripePaymentForm
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    amount={getTotal()}
                  />
                </Elements>
              </div>
            )}
          </div>

          {/* Récapitulatif */}
          <div className="checkout-sidebar">
            <div className="checkout-summary-card">
              <h2 className="checkout-summary-title">Récapitulatif</h2>

              <div className="checkout-summary-items">
                {cart.map((item) => (
                  <div key={item.id} className="checkout-summary-item">
                    <div className="checkout-summary-item-image">
                      <Image 
                        src={item.basketImage} 
                        alt={item.basketName}
                        width={50}
                        height={50}
                      />
                    </div>
                    <div className="checkout-summary-item-info">
                      <span className="checkout-summary-item-name">
                        {item.basketName}
                      </span>
                      <span className="checkout-summary-item-quantity">
                        Qté: {item.quantity}
                      </span>
                    </div>
                    <div className="checkout-summary-item-price">
                      {(item.price * item.quantity).toFixed(2)}€
                    </div>
                  </div>
                ))}
              </div>

              <div className="checkout-summary-divider"></div>

              <div className="checkout-summary-details">
                <div className="checkout-summary-row">
                  <span>Sous-total</span>
                  <span>{getTotal().toFixed(2)}€</span>
                </div>
                <div className="checkout-summary-row">
                  <span>Frais de service</span>
                  <span>0,00€</span>
                </div>
              </div>

              <div className="checkout-summary-total">
                <span>Total</span>
                <span className="checkout-summary-total-amount">
                  {getTotal().toFixed(2)}€
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;