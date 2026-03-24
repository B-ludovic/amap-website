import { ShoppingBasket, Users, Heart, Leaf, LeafyGreen, Apple, Egg, Wheat, ArrowRight, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import '../styles/public/home.css';

const categoryIcon = (category) => {
  switch (category) {
    case 'FRUITS':    return Apple;
    case 'EGGS':      return Egg;
    case 'GROCERY':   return Wheat;
    case 'VEGETABLES':
    default:          return LeafyGreen;
  }
};

async function fetchCurrentBasket() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/weekly-baskets/current`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

async function fetchProducers() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/producers`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.producers || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [producers, currentBasket] = await Promise.all([fetchProducers(), fetchCurrentBasket()]);
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
              <ShoppingBasket size={20} aria-hidden="true" />
              Découvrir nos abonnements
            </Link>
            <Link href="/panier-semaine" className="btn btn-primary btn-lg">
              Voir le panier de la semaine
            </Link>
          </div>
        </div>
      </section>

      {/* Panier de la semaine */}
      {currentBasket && (
        <section className="current-basket-preview-section">
          <div className="container">
            <div className="current-basket-preview-card">
              <div className="current-basket-preview-header">
                <div className="current-basket-preview-badge">
                  <ShoppingBasket size={18} aria-hidden="true" />
                  <span>Panier de la semaine</span>
                </div>
                <h2>Semaine {currentBasket.weekNumber} · {currentBasket.year}</h2>
                {currentBasket.notes && (
                  <p className="current-basket-preview-notes">{currentBasket.notes}</p>
                )}
              </div>
              <ul className="current-basket-preview-items">
                {currentBasket.items.slice(0, 6).map(item => {
                  const Icon = item.product ? categoryIcon(item.product.category) : Leaf;
                  return (
                    <li key={item.id}>
                      <Icon size={14} />
                      <span>{item.product?.name || item.customProductName}</span>
                    </li>
                  );
                })}
                {currentBasket.items.length > 6 && (
                  <li className="more-items">
                    +{currentBasket.items.length - 6} autre{currentBasket.items.length - 6 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
              <Link href="/panier-semaine" className="btn btn-primary">
                Voir la composition complète
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* AMAP Solidaire */}
      <section className="solidarity-section">
        <div className="container">
          <div className="solidarity-badge">
            <Heart size={24} aria-hidden="true" />
            <span>AMAP Solidaire</span>
          </div>
          <h2>Une AMAP accessible à tous</h2>
          <p className="section-description">
            En partenariat avec le Secours Catholique, nous proposons un tarif solidaire
            pour permettre à chacun d'accéder à une alimentation saine et locale.
          </p>
          <div className="cta-center">
            <Link href="/nos-abonnements" className="btn btn-primary">
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      {/* Nos valeurs */}
      <section className="values-section">
        <div className="container">
          <h2 className="section-title">Nos valeurs</h2>
          
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">
                <Leaf size={32} aria-hidden="true" />
              </div>
              <h3>Agriculture biologique</h3>
              <p>
                Tous nos producteurs pratiquent une agriculture respectueuse de l'environnement, 
                certifiée bio ou en conversion.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">
                <Users size={32} aria-hidden="true" />
              </div>
              <h3>Circuit court</h3>
              <p>
                Nos producteurs sont tous situés à moins de 30 km. Vous connaissez l'origine 
                de vos légumes et soutenez directement les agriculteurs locaux.
              </p>
            </div>

            <div className="value-card">
              <div className="value-icon">
                <Heart size={32} aria-hidden="true" />
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
              <ArrowRight size={20} aria-hidden="true" />
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

          {producers.length > 0 && (
            <div className="producers-preview-grid">
              {producers.slice(0, 3).map(producer => (
                <div key={producer.id} className="producer-preview-card">
                  <div className="producer-preview-icon">
                    <Leaf size={24} aria-hidden="true" />
                  </div>
                  <h3>{producer.name}</h3>
                  {producer.specialty && (
                    <p className="producer-preview-specialty">{producer.specialty}</p>
                  )}
                  {producer.description && (
                    <p className="producer-preview-desc">{producer.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="cta-center">
            <Link href="/nos-producteurs" className="btn btn-primary">
              Rencontrer nos producteurs
            </Link>
          </div>
        </div>
      </section>

      {/* Où et quand */}
      <section className="location-section">
        <div className="container">
          <h2 className="section-title">Où et quand nous trouver ?</h2>
          <div className="location-cards">
            <div className="location-card">
              <div className="location-icon">
                <MapPin size={28} aria-hidden="true" />
              </div>
              <h3>Point de retrait</h3>
              <p>
                Paroisse Saint François de Sales de Clamart<br />
                340 Avenue du Général de Gaulle<br />
                92140 Clamart
              </p>
              <a
                href="https://maps.google.com/?q=340+Avenue+du+Général+de+Gaulle,+92140+Clamart"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Voir sur la carte
              </a>
            </div>
            <div className="location-card">
              <div className="location-icon">
                <Clock size={28} aria-hidden="true" />
              </div>
              <h3>Horaires de distribution</h3>
              <p>
                Chaque <strong>mercredi</strong><br />
                de <strong>18h15 à 19h15</strong>
              </p>
              <Link href="/panier-semaine" className="btn btn-primary">
                Voir le panier de la semaine
              </Link>
            </div>
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
              <Leaf size={20} aria-hidden="true" />
              Candidater
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
