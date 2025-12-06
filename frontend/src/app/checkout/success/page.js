'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Mail, Package, Bell, MapPin } from 'lucide-react';

function CheckoutSuccessPage() {
  useEffect(() => {
    // Effacer le panier du localStorage (au cas où)
    localStorage.removeItem('cart');
  }, []);

  return (
    <div className="checkout-success-page">
      <div className="container">
        <div className="success-card">
          <div className="success-icon">
            <CheckCircle size={80} strokeWidth={1.5} />
          </div>

          <h1 className="success-title">Commande confirmée !</h1>

          <p className="success-message">
            Merci pour votre commande ! Vous allez recevoir un email de
            confirmation avec tous les détails.
          </p>

          <div className="success-info">
            <h2 className="success-info-title">Prochaines étapes</h2>
            <ul className="success-info-list">
              <li>
                <Mail size={20} />
                <span>Vous recevrez un email de confirmation</span>
              </li>
              <li>
                <Package size={20} />
                <span>Votre commande sera préparée par nos producteurs</span>
              </li>
              <li>
                <Bell size={20} />
                <span>Vous recevrez un rappel la veille du retrait</span>
              </li>
              <li>
                <MapPin size={20} />
                <span>Venez récupérer votre panier au point de retrait choisi</span>
              </li>
            </ul>
          </div>

          <div className="success-actions">
            <Link href="/compte/commandes" className="btn btn-primary btn-lg">
              Voir mes commandes
            </Link>
            <Link href="/paniers" className="btn btn-outline btn-lg">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutSuccessPage;