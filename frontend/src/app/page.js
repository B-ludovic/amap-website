'use client';

import { ShoppingBasket, Users, Heart, Leaf, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import '../styles/public/home.css';

export default function HomePage() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Aux P'tits Pois</h1>
          <p className="hero-subtitle">
            Votre AMAP solidaire pour des produits locaux et bio
          </p>
          <p className="hero-description">
            Soutenez l'agriculture locale et profitez chaque semaine de paniers de légumes frais, 
            cultivés avec soin par nos producteurs partenaires.
          </p>
          <div className="hero-actions">
            <Link href="/nos-abonnements" className="btn btn-primary btn-lg">
              <ShoppingBasket size={20} />
              Découvrir nos abonnements
            </Link>
            <Link href="/panier-semaine" className="btn btn-secondary btn-lg">
              Voir le panier de la semaine
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-image-placeholder">
            <Image 
              src="/agriculteurs.png" 
              alt="Agriculteur local"
              width={400}
              height={400}
              priority
            />
          </div>
        </div>
      </section>

      {/* AMAP Solidaire */}
      <section className="solidarity-section">
        <div className="container">
          <div className="solidarity-badge">
            <Heart size={24} />
            <span>AMAP Solidaire</span>
          </div>
          <h2>Une AMAP accessible à tous</h2>
          <p className="section-description">
            En partenariat avec le Secours Catholique, nous proposons un tarif solidaire 
            pour permettre à chacun d'accéder à une alimentation saine et locale.
          </p>
        </div>
      </section>

      {/* Nos valeurs */}
      <section className="values-section">
        <div className="container">
          <h2 className="section-title">Nos valeurs</h2>
          
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">
                <Leaf size={32} />
              </div>
              <h3>Agriculture biologique</h3>
              <p>
                Tous nos producteurs pratiquent une agriculture respectueuse de l'environnement, 
                certifiée bio ou en conversion.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">
                <Users size={32} />
              </div>
              <h3>Circuit court</h3>
              <p>
                Nos producteurs sont tous situés à moins de 30 km. Vous connaissez l'origine 
                de vos légumes et soutenez directement les agriculteurs locaux.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">
                <Heart size={32} />
              </div>
              <h3>Solidarité</h3>
              <p>
                Grâce à notre tarif solidaire, l'alimentation bio et locale est accessible 
                à tous, sans exception.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">Comment ça marche ?</h2>
          
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Je choisis mon abonnement</h3>
              <p>
                Abonnement annuel ou découverte (3 mois), avec un petit ou grand panier 
                selon vos besoins.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Je remplis le formulaire</h3>
              <p>
                Nous vous recontactons pour finaliser votre inscription et organiser 
                le paiement (chèque, virement ou espèces).
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Je récupère mon panier</h3>
              <p>
                Chaque mercredi de 18h15 à 19h15, venez chercher votre panier de légumes 
                frais au point de retrait.
              </p>
            </div>
          </div>

          <div className="cta-center">
            <Link href="/nos-abonnements" className="btn btn-primary btn-lg">
              <ArrowRight size={20} />
              Je découvre les abonnements
            </Link>
          </div>
        </div>
      </section>

      {/* Nos producteurs */}
      <section className="producers-section">
        <div className="container">
          <h2 className="section-title">Nos producteurs</h2>
          <p className="section-description">
            Découvrez les agriculteurs passionnés qui cultivent vos légumes avec soin et respect.
          </p>
          
          <div className="cta-center">
            <Link href="/nos-producteurs" className="btn btn-secondary">
              Rencontrer nos producteurs
            </Link>
          </div>
        </div>
      </section>

      {/* Devenir producteur */}
      <section className="join-section">
        <div className="container">
          <div className="join-card">
            <h2>Vous êtes producteur local ?</h2>
            <p>
              Rejoignez notre réseau de producteurs et bénéficiez de débouchés garantis 
              pour vos produits bio et locaux.
            </p>
            <Link href="/devenir-producteur" className="btn btn-primary">
              <Leaf size={20} />
              Candidater
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
