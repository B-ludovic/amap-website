'use client';

import { Cookie, ShieldCheck, BarChart3, CreditCard, Settings } from 'lucide-react';
import '../../styles/public/legal.css'

export default function MentionsLegalesPage() {
  const handleOpenCookiePanel = () => {
    if (typeof window !== 'undefined' && window.tarteaucitron) {
      window.tarteaucitron.userInterface.openPanel();
    }
  };

  return (
    <div className="legal-page">
      <div className="container">
        <h1>Mentions Légales</h1>
        
        <section className="legal-section">
          <h2>Éditeur du site</h2>
          <p>
            <strong>Aux P'tits Pois</strong><br />
            Association loi 1901<br />
            Adresse : 14, rue du Chateau 45300 Yère-la-ville<br />
            Email : lestroisparcelles@gmail.com
          </p>
        </section>

        <section className="legal-section">
          <h2>Hébergement</h2>
          <p>
            Le site est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            340 S Lemon Ave #4133<br />
            Walnut, CA 91789, USA<br />
            Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
          </p>
        </section>

        <section id="cookies" className="legal-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cookie size={28} style={{ color: 'var(--primary-color)' }} />
            Politique de cookies
          </h2>
          
          <h3>Qu'est-ce qu'un cookie ?</h3>
          <p>
            Un cookie est un petit fichier texte déposé sur votre ordinateur lors de la visite d'un site web. 
            Il permet de mémoriser des informations relatives à votre navigation et de vous offrir une expérience personnalisée.
          </p>

          <h3>Cookies utilisés sur notre site</h3>
          
          <h4>1. Cookies strictement nécessaires</h4>
          <p>
            Ces cookies sont indispensables au bon fonctionnement du site et ne peuvent pas être désactivés :
          </p>
          <ul className="legal-list">
            <li><strong>Authentification</strong> : Permettent de vous identifier et d'accéder à votre espace membre</li>
            <li><strong>Panier</strong> : Mémorisent vos sélections de produits</li>
            <li><strong>Sécurité</strong> : Protection contre les attaques et fraudes</li>
            <li><strong>Gestion du consentement</strong> : Mémorise vos choix concernant les cookies</li>
          </ul>

          <h4>2. Cookies de paiement</h4>
          <p>
            <strong>Stripe</strong> : Notre prestataire de paiement sécurisé utilise des cookies pour assurer la sécurité des transactions.
          </p>

          <h4>3. Cookies analytiques (optionnels)</h4>
          <p>
            Avec votre consentement, nous utilisons Google Analytics pour comprendre comment vous utilisez notre site. 
            Ces statistiques sont anonymisées et nous aident à améliorer votre expérience.
          </p>

          <h3>Gérer vos préférences</h3>
          <p>
            Vous pouvez à tout moment modifier vos préférences en cliquant sur le bouton ci-dessous :
          </p>
          
          <button 
            onClick={handleOpenCookiePanel}
            className="btn btn-primary btn-cookies"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
          >
            <Settings size={20} />
            Gérer mes cookies
          </button>

          <h3>Durée de conservation</h3>
          <ul className="legal-list">
            <li>Cookies de session : Supprimés à la fermeture du navigateur</li>
            <li>Cookies de consentement : 13 mois</li>
            <li>Cookies analytiques : 13 mois maximum</li>
          </ul>

          <h3>Vos droits</h3>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. 
            Pour exercer ces droits, contactez-nous à : <a href="mailto:auxptitspois@gmail.com">auxptitspois@gmail.com</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (textes, images, logos) est la propriété de l'association Aux P'tits Pois 
            et est protégé par les lois sur la propriété intellectuelle.
          </p>
        </section>

        <section className="legal-section">
          <h2>Données personnelles</h2>
          <p>
            Les informations collectées sur ce site sont destinées uniquement à la gestion de votre abonnement et des distributions. 
            Elles ne sont jamais transmises à des tiers.
          </p>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
          </p>
        </section>
      </div>
    </div>
  );
}