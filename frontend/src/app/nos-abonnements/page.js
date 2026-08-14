'use client';

import { useState } from 'react';
import Link from 'next/link';
import '../../styles/public/subscriptions.css';

const SIZES = {
  SMALL: { label: 'Petit panier', name: 'Petit panier', weight: '2 à 4 kg', hint: '1 à 2 personnes', weekly: '19,00 €' },
  LARGE: { label: 'Grand panier', name: 'Grand panier', weight: '6 à 8 kg', hint: 'famille', weekly: '29,80 €' },
};

const SUBSCRIPTIONS = [
  {
    id: 'annual-small',
    type: 'ANNUAL',
    size: 'SMALL',
    name: 'Abonnement annuel',
    duration: '49 semaines · 1 an',
    priceNormal: 931,
    priceSolidarity: 186.20,
    weeks: 49,
    features: [
      'Engagement sur 1 an (49 semaines)',
      'Distribution hebdomadaire',
      'Légumes de saison variés',
      'Possibilité de pause pour les vacances',
      'Paiement en plusieurs fois par chèque',
      'Soutien direct aux producteurs locaux',
    ],
  },
  {
    id: 'annual-large',
    type: 'ANNUAL',
    size: 'LARGE',
    name: 'Abonnement annuel',
    duration: '49 semaines · 1 an',
    priceNormal: 1460.20,
    priceSolidarity: 292.04,
    weeks: 49,
    recommended: true,
    features: [
      'Engagement sur 1 an (49 semaines)',
      'Distribution hebdomadaire',
      'Légumes de saison variés',
      'Volume pensé pour une famille',
      'Possibilité de pause pour les vacances',
      'Paiement en plusieurs fois par chèque',
    ],
  },
  {
    id: 'discovery-small',
    type: 'DISCOVERY',
    size: 'SMALL',
    name: 'Abonnement découverte',
    duration: '12 semaines · 3 mois',
    priceNormal: 228,
    priceSolidarity: 45.60,
    weeks: 12,
    comingSoon: true,
    features: [
      'Engagement sur 3 mois (12 semaines)',
      'Distribution hebdomadaire',
      "Parfait pour découvrir l'AMAP",
      'Paiement en plusieurs fois par chèque',
      'Sans engagement long terme',
    ],
  },
  {
    id: 'discovery-large',
    type: 'DISCOVERY',
    size: 'LARGE',
    name: 'Abonnement découverte',
    duration: '12 semaines · 3 mois',
    priceNormal: 357.60,
    priceSolidarity: 71.52,
    weeks: 12,
    comingSoon: true,
    features: [
      'Engagement sur 3 mois (12 semaines)',
      'Distribution hebdomadaire',
      'Volume pensé pour une famille',
      "Parfait pour découvrir l'AMAP",
      'Paiement en plusieurs fois par chèque',
    ],
  },
];

/* Formatage maison plutôt qu'Intl : le rendu doit être identique côté serveur
   et côté navigateur, sans quoi React signale une divergence d'hydratation. */
function euro(value) {
  const [whole, cents] = value.toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${cents} €`;
}

export default function SubscriptionsPage() {
  const [selectedSize, setSelectedSize] = useState('LARGE');

  const size = SIZES[selectedSize];
  const plans = SUBSCRIPTIONS.filter(sub => sub.size === selectedSize);

  return (
    <div className="subscriptions-page">

      {/* Hero */}
      <section className="container subs-hero">
        <div>
          <div className="eyebrow">Adhésion · saison 2026 — 2027</div>
          <h1 className="subs-title">On s&apos;engage à l&apos;année, des deux côtés.</h1>
          <p className="subs-lede">
            Vous réservez votre part de récolte pour 49 semaines ; le maraîcher sait ce
            qu&apos;il sème. C&apos;est tout le principe d&apos;une AMAP — et c&apos;est ce
            qui rend le prix stable.
          </p>
        </div>

        <dl className="facts">
          <div className="fact">
            <dt className="fact-value">49</dt>
            <dd className="fact-label">distributions par an, hors fermetures collectives</dd>
          </div>
          <div className="fact">
            <dt className="fact-value">2</dt>
            <dd className="fact-label">semaines de pause par foyer et par an</dd>
          </div>
          <div className="fact">
            <dt className="fact-value">20 %</dt>
            <dd className="fact-label">part réglée par l&apos;adhérent au tarif solidaire</dd>
          </div>
        </dl>
      </section>

      {/* Bandeau solidaire */}
      <section className="band-forest">
        <div className="container subs-solidarity">
          <div className="eyebrow eyebrow-on-forest">AMAP solidaire</div>
          <p className="subs-solidarity-text">
            En partenariat avec le Secours Catholique, le tarif solidaire ramène votre part
            à <span className="mono-strong">20 %</span> du prix. Le reste est pris en charge
            — sans dossier lourd, sans distinction le jour de la distribution.
          </p>
          <Link href="/contact" className="btn btn-ghost-forest subs-solidarity-cta">
            Nous en parler
          </Link>
        </div>
      </section>

      {/* Formules */}
      <section id="formules" className="container subs-plans">
        <div className="subs-plans-head">
          <div>
            <div className="eyebrow">Étape 1 · la taille du panier</div>
            <h2 className="section-display">Deux volumes, un même contenu.</h2>
          </div>
          <div className="size-switch" role="group" aria-label="Choisir la taille du panier">
            {Object.entries(SIZES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`size-pill ${key === selectedSize ? 'is-active' : ''}`}
                aria-pressed={key === selectedSize}
                onClick={() => setSelectedSize(key)}
              >
                {value.label}
              </button>
            ))}
          </div>
        </div>

        <div className="subs-summary">
          <div className="subs-summary-card">
            <div className="subs-summary-label">Sélection</div>
            <div>
              <div className="subs-summary-name">{size.name}</div>
              <div className="subs-summary-meta">{size.weight} · {size.hint}</div>
            </div>
          </div>
          <div className="subs-summary-card">
            <div className="subs-summary-label">Soit</div>
            <div>
              <div className="subs-summary-price">{size.weekly} / semaine</div>
              <div className="subs-summary-note">au tarif normal, sur l&apos;abonnement annuel</div>
            </div>
          </div>
        </div>

        <div className="eyebrow subs-step-two">Étape 2 · la durée d&apos;engagement</div>

        <div className="subs-grid">
          {plans.map(plan => {
            const weeksLabel = `sur ${plan.weeks} semaines`;
            const tag = plan.comingSoon
              ? 'Bientôt disponible'
              : plan.recommended ? 'Le plus choisi' : 'Ouvert aux inscriptions';

            return (
              <article
                key={plan.id}
                className={`plan-card${plan.recommended ? ' is-recommended' : ''}${plan.comingSoon ? ' is-soon' : ''}`}
              >
                <div className="plan-flag">{tag}</div>
                <div className="eyebrow plan-duration">{plan.duration}</div>
                <h3 className="plan-name">{plan.name}</h3>

                <div className="plan-prices">
                  <div className="plan-price">
                    <div className="eyebrow plan-price-label">Tarif normal</div>
                    <div className="plan-price-value">{euro(plan.priceNormal)}</div>
                    <div className="plan-price-weeks">{weeksLabel}</div>
                  </div>
                  <div className="plan-price is-solidarity">
                    <div className="eyebrow plan-price-label">Tarif solidaire</div>
                    <div className="plan-price-value">{euro(plan.priceSolidarity)}</div>
                    <div className="plan-price-weeks">{weeksLabel}</div>
                  </div>
                </div>

                <div className="plan-features">
                  {plan.features.map(feature => (
                    <div className="plan-feature" key={feature}>
                      <span className="plan-dot" aria-hidden="true" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.comingSoon ? (
                  <span className="plan-cta is-disabled" aria-disabled="true">
                    Disponible ultérieurement
                  </span>
                ) : (
                  <Link
                    href={`/demande-abonnement?type=${plan.type}&size=${plan.size}`}
                    className="plan-cta"
                  >
                    Faire une demande
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Informations pratiques */}
      <section className="band-sand">
        <div className="container subs-practical">
          <div className="eyebrow">Informations pratiques</div>
          <h2 className="section-display subs-practical-title">
            Ce qu&apos;il faut savoir avant de signer.
          </h2>

          <ol className="steps">
            <li className="step">
              <div className="step-rule">
                <span className="step-number">01</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Distribution</h3>
              <p className="step-text subs-step-text">
                Chaque mercredi de <span className="mono-strong">18h15 à 19h15</span>. Un
                panier non retiré est redistribué le soir même.
              </p>
              <p className="subs-address">
                Paroisse Saint François de Sales<br />
                340 avenue du Général de Gaulle<br />
                92140 Clamart
              </p>
            </li>
            <li className="step">
              <div className="step-rule">
                <span className="step-number">02</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Composition</h3>
              <p className="step-text">
                Le panier est composé chaque semaine par le producteur selon les légumes de
                saison disponibles. La composition est publiée avant chaque distribution —
                pas de choix à la carte, c&apos;est la récolte qui décide.
              </p>
            </li>
            <li className="step">
              <div className="step-rule">
                <span className="step-number">03</span>
                <span className="step-line" aria-hidden="true" />
              </div>
              <h3 className="step-title">Paiement</h3>
              <p className="step-text">
                Uniquement par chèque, encaissable en plusieurs fois sur l&apos;année. Nous
                vous recontactons après votre demande pour finaliser le contrat.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Demande */}
      <section id="demande" className="container subs-cta">
        <div className="subs-cta-card">
          <div>
            <h2 className="subs-cta-title">Une place se libère, on vous écrit.</h2>
            <p className="subs-cta-text">
              Remplissez la demande — deux minutes — et nous revenons vers vous pour le
              contrat et le règlement. Aucune somme n&apos;est engagée avant cet échange.
            </p>
          </div>
          <div className="subs-cta-actions">
            <Link href="/demande-abonnement" className="btn btn-primary btn-lg">
              Faire ma demande
            </Link>
            <Link href="/panier-semaine" className="btn btn-secondary btn-lg">
              Voir un panier type
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
