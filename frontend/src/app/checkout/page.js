'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../contexts/CartContext';
import Image from 'next/image';
import { CreditCard, Lock, MapPin, Calendar } from 'lucide-react';

function CheckoutPage() {
  const router = useRouter();
  const { cart, getTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Vérifier l'authentification
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    setUser(JSON.parse(userData));

    // Vérifier que le panier n'est pas vide
    if (cart.length === 0) {
      router.push('/panier');
    }
  }, [cart, router]);

  const handleSubmitOrder = async () => {
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

      // Simulation
      setTimeout(() => {
        console.log('Commande créée:', orderItems);
        
        // Vider le panier
        clearCart();
        
        // Rediriger vers la page de confirmation
        router.push('/checkout/success');
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="checkout-page">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

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

            {/* Paiement */}
            <div className="checkout-section">
              <h2 className="checkout-section-title">
                <Lock size={20} /> Paiement sécurisé
              </h2>
              <div className="checkout-payment-info">
                <p className="checkout-payment-text">
                  Le paiement sera traité de manière sécurisée via Stripe.
                </p>
                <p className="checkout-payment-note">
                  En cliquant sur "Passer la commande", vous serez redirigé vers
                  notre page de paiement sécurisée.
                </p>
              </div>
            </div>
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
                        style={{ objectFit: 'contain' }}
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

              <button
                onClick={handleSubmitOrder}
                disabled={loading}
                className="btn btn-primary btn-lg checkout-submit-btn"
              >
                {loading ? (
                  'Traitement en cours...'
                ) : (
                  <>
                    <CreditCard size={20} />
                    Passer la commande
                  </>
                )}
              </button>

              <p className="checkout-security-note">
                <Lock size={16} /> Paiement 100% sécurisé
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;