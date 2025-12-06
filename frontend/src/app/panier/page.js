'use client';

import { useCart } from '../../contexts/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, ShoppingBag, CreditCard, Calendar, MapPin } from 'lucide-react';

export default function PanierPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, getTotal, clearCart } = useCart();

  const handleCheckout = () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      router.push('/auth/login');
      return;
    }

    if (cart.length === 0) {
      alert('Votre panier est vide');
      return;
    }

    // TODO: Rediriger vers la page de paiement
    router.push('/checkout');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (cart.length === 0) {
    return (
      <div className="panier-page">
        <div className="container">
          <h1 className="page-title">Mon Panier</h1>
          
          <div className="empty-cart">
            <ShoppingBag size={80} strokeWidth={1} />
            <h2>Votre panier est vide</h2>
            <p>Découvrez nos délicieux paniers de produits locaux</p>
            <Link href="/paniers" className="btn btn-primary btn-lg">
              Découvrir nos paniers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panier-page">
      <div className="container">
        <div className="panier-header">
          <h1 className="page-title">Mon Panier</h1>
          <button onClick={clearCart} className="btn btn-outline btn-sm">
            <Trash2 size={18} />
            Vider le panier
          </button>
        </div>

        <div className="panier-content">
          {/* Liste des articles */}
          <div className="panier-items">
            {cart.map((item) => (
              <div key={item.id} className="panier-item">
                <div className="panier-item-image">
                  <Image 
                    src={item.basketImage} 
                    alt={item.basketName}
                    width={80}
                    height={80}
                    style={{ objectFit: 'contain' }}
                  />
                </div>

                <div className="panier-item-info">
                  <h3 className="panier-item-name">{item.basketName}</h3>
                  <p className="panier-item-date">
                    <Calendar size={16} />
                    {formatDate(item.distributionDate)}
                  </p>
                  {item.pickupLocation && (
                    <p className="panier-item-location">
                      <MapPin size={16} />
                      {item.pickupLocation.name}
                    </p>
                  )}
                  <p className="panier-item-price">
                    {item.price.toFixed(2)}€ / unité
                  </p>
                </div>

                <div className="panier-item-actions">
                  <div className="panier-item-quantity">
                    <button
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button
                      className="quantity-btn"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>

                  <div className="panier-item-total">
                    {(item.price * item.quantity).toFixed(2)}€
                  </div>

                  <button
                    className="panier-item-remove"
                    onClick={() => removeFromCart(item.id)}
                    title="Retirer du panier"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Récapitulatif */}
          <div className="panier-summary">
            <div className="panier-summary-card">
              <h2 className="panier-summary-title">Récapitulatif</h2>

              <div className="panier-summary-details">
                <div className="panier-summary-row">
                  <span>Sous-total</span>
                  <span>{getTotal().toFixed(2)}€</span>
                </div>
                <div className="panier-summary-row">
                  <span>Frais de service</span>
                  <span>0,00€</span>
                </div>
              </div>

              <div className="panier-summary-total">
                <span>Total</span>
                <span className="panier-summary-total-amount">
                  {getTotal().toFixed(2)}€
                </span>
              </div>

              <button
                onClick={handleCheckout}
                className="btn btn-primary btn-lg"
              >
                <CreditCard size={20} />
                Passer la commande
              </button>

              <Link href="/paniers" className="panier-continue-shopping">
                ← Continuer mes achats
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
