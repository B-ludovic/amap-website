'use client';

import { useState } from 'react';
import { Check, ShoppingBasket, Calendar, Heart } from 'lucide-react';
import Link from 'next/link';
import '../../styles/public/subscriptions.css';

export default function SubscriptionsPage() {
  const [selectedSize, setSelectedSize] = useState('SMALL');

  const subscriptions = [
    {
      id: 'annual-small',
      type: 'ANNUAL',
      size: 'SMALL',
      name: 'Abonnement Annuel',
      basketName: 'Petit Panier',
      weight: '2 à 4 kg',
      priceNormal: 888,
      priceSolidarity: 177.60,
      weeks: 48,
      features: [
        'Engagement sur 1 an (48 semaines)',
        'Distribution hebdomadaire',
        'Légumes de saison variés',
        'Possibilité de pause (vacances)',
        'Paiement en plusieurs fois par chèque',
        'Soutien aux producteurs locaux'
      ],
      recommended: false
    },
    {
      id: 'annual-large',
      type: 'ANNUAL',
      size: 'LARGE',
      name: 'Abonnement Annuel',
      basketName: 'Grand Panier',
      weight: '6 à 8 kg',
      priceNormal: 1392,
      priceSolidarity: 278.40,
      weeks: 48,
      features: [
        'Engagement sur 1 an (48 semaines)',
        'Distribution hebdomadaire',
        'Légumes de saison variés',
        'Idéal pour famille',
        'Possibilité de pause (vacances)',
        'Paiement en plusieurs fois par chèque',
        'Soutien aux producteurs locaux'
      ],
      recommended: true
    },
    {
      id: 'discovery-small',
      type: 'DISCOVERY',
      size: 'SMALL',
      name: 'Abonnement Découverte',
      basketName: 'Petit Panier',
      weight: '2 à 4 kg',
      priceNormal: 222,
      priceSolidarity: 44.40,
      duration: '12 semaines',
      weeks: 12,
      features: [
        'Engagement sur 3 mois (12 semaines)',
        'Distribution hebdomadaire',
        'Parfait pour découvrir l\'AMAP',
        'Paiement en plusieurs fois par chèque',
        'Sans engagement long terme'
      ],
      recommended: false
    },
    {
      id: 'discovery-large',
      type: 'DISCOVERY',
      size: 'LARGE',
      name: 'Abonnement Découverte',
      basketName: 'Grand Panier',
      weight: '6 à 8 kg',
      priceNormal: 348,
      priceSolidarity: 69.60,
      duration: '12 semaines',
      weeks: 12,
      features: [
        'Engagement sur 3 mois (12 semaines)',
        'Distribution hebdomadaire',
        'Idéal pour famille',
        'Parfait pour découvrir l\'AMAP',
        'Paiement en plusieurs fois par chèque',
        'Sans engagement long terme'
      ],
      recommended: false
    }
  ];

  const filteredSubscriptions = subscriptions.filter(sub => sub.size === selectedSize);

  return (
    <div className="subscriptions-page">
      {/* Hero */}
      <section className="subscriptions-hero">
        <div className="container">
          <h1>Nos Abonnements</h1>
          <p className="hero-subtitle">
            Choisissez la formule qui vous correspond et profitez chaque semaine 
            de légumes frais et de saison
          </p>
        </div>
      </section>

      {/* Info AMAP Solidaire */}
      <section className="solidarity-info">
        <div className="container">
          <div className="solidarity-banner">
            <Heart size={24} />
            <div>
              <strong>AMAP Solidaire</strong>
              <p>
                En partenariat avec le Secours Catholique, nous proposons un tarif solidaire 
                (20% du prix normal). Le reste est pris en charge pour vous permettre d'accéder 
                à une alimentation saine et locale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sélecteur de taille */}
      <section className="subscriptions-content">
        <div className="container">
          <div className="size-selector">
            <h2>Choisissez la taille de votre panier</h2>
            <div className="size-buttons">
              <button
                className={`size-button ${selectedSize === 'SMALL' ? 'active' : ''}`}
                onClick={() => setSelectedSize('SMALL')}
              >
                <ShoppingBasket size={24} />
                <div>
                  <strong>Petit Panier</strong>
                  <span>2 à 4 kg</span>
                  <span className="size-hint">Idéal pour 1-2 personnes</span>
                </div>
              </button>
              <button
                className={`size-button ${selectedSize === 'LARGE' ? 'active' : ''}`}
                onClick={() => setSelectedSize('LARGE')}
              >
                <ShoppingBasket size={32} />
                <div>
                  <strong>Grand Panier</strong>
                  <span>6 à 8 kg</span>
                  <span className="size-hint">Idéal pour famille</span>
                </div>
              </button>
            </div>
          </div>

          {/* Cartes d'abonnements */}
          <div className="subscriptions-grid">
            {filteredSubscriptions.map((sub) => (
              <div 
                key={sub.id} 
                className={`subscription-card ${sub.recommended ? 'recommended' : ''}`}
              >
                {sub.recommended && (
                  <div className="recommended-badge">Recommandé</div>
                )}

                <div className="subscription-header">
                  <h3>{sub.name}</h3>
                  <div className="basket-info">
                    <span className="basket-name">{sub.basketName}</span>
                    <span className="basket-weight">{sub.weight}</span>
                  </div>
                </div>

                <div className="subscription-pricing">
                  <div className="price-item">
                    <span className="price-label">Tarif normal</span>
                    <div className="price-value">
                      <span className="price-amount">{sub.priceNormal}€</span>
                      {sub.weeks && <span className="price-duration">/ {sub.weeks} semaines</span>}
                    </div>
                  </div>
                  <div className="price-item solidarity">
                    <span className="price-label">
                      <Heart size={16} />
                      Tarif solidaire (20%)
                    </span>
                    <div className="price-value">
                      <span className="price-amount">{sub.priceSolidarity}€</span>
                      {sub.weeks && <span className="price-duration">/ {sub.weeks} semaines</span>}
                    </div>
                  </div>
                </div>

                <ul className="subscription-features">
                  {sub.features.map((feature, index) => (
                    <li key={index}>
                      <Check size={20} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link 
                  href={`/demande-abonnement?type=${sub.type}&size=${sub.size}`}
                  className="btn btn-primary btn-block"
                >
                  Faire une demande
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Informations pratiques */}
      <section className="practical-info">
        <div className="container">
          <h2>Informations pratiques</h2>
          
          <div className="info-grid">
            <div className="info-card">
              <Calendar size={32} />
              <h3>Distribution</h3>
              <p>
                Chaque <strong>mercredi</strong> de <strong>18h15 à 19h15</strong>
              </p>
            </div>

            <div className="info-card">
              <ShoppingBasket size={32} />
              <h3>Composition</h3>
              <p>
                Vous composez vous-même votre panier parmi les légumes disponibles 
                selon votre abonnement
              </p>
            </div>

            <div className="info-card">
              <Heart size={32} />
              <h3>Paiement</h3>
              <p>
                Chèque, virement ou espèces. Nous vous recontactons après votre demande 
                pour finaliser l'inscription.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="subscriptions-cta">
        <div className="container">
          <div className="cta-card">
            <h2>Prêt à rejoindre l'aventure ?</h2>
            <p>
              Remplissez le formulaire de demande et nous vous recontacterons rapidement 
              pour finaliser votre inscription.
            </p>
            <Link href="/demande-abonnement" className="btn btn-primary btn-lg">
              Faire ma demande d'abonnement
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}