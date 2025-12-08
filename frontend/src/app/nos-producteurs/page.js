'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sprout, MapPin, Package, Leaf, Mail, Phone, ExternalLink  } from 'lucide-react';
import Link from 'next/link';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import '../../styles/public/producers.css';

export default function ProducersPage() {
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showModal } = useModal();

  useEffect(() => {
    fetchProducers();
  }, []);

  const fetchProducers = async () => {
    try {
      setLoading(true);
      const response = await api.producers.getAll();
      // Filtrer pour n'afficher que les producteurs actifs et non-exemples
      const activeProducers = response.data.filter(
        producer => producer.isActive && !producer.isExample
      );
      setProducers(activeProducers);
    } catch (error) {
      showModal('Erreur lors du chargement des producteurs', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="producers-page">
        <div className="container">
          <div className="loading-state">Chargement des producteurs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="producers-page">
      {/* Hero */}
      <section className="producers-hero">
        <div className="container">
          <div className="hero-content">
            <h1>Nos Producteurs</h1>
            <p className="hero-subtitle">
              Découvrez les agriculteurs passionnés qui cultivent vos légumes 
              avec soin et respect de l'environnement.
            </p>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">{producers.length}</span>
                <span className="stat-label">Producteurs partenaires</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">Agriculture biologique</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">&lt; 30 km</span>
                <span className="stat-label">Rayon maximum</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="producers-intro">
        <div className="container">
          <div className="intro-card">
            <div className="intro-icon">
              <Leaf size={48} />
            </div>
            <div className="intro-content">
              <h2>Des producteurs engagés</h2>
              <p>
                Tous nos producteurs partagent les valeurs de l'AMAP : respect de l'environnement, 
                agriculture biologique, circuit court et prix équitables. Ils s'engagent à fournir 
                des produits de qualité, cultivés avec passion sur des exploitations à taille humaine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Liste des producteurs */}
      <section className="producers-list">
        <div className="container">
          {producers.length === 0 ? (
            <div className="empty-state">
              <Sprout size={64} />
              <h3>Aucun producteur</h3>
              <p>La liste des producteurs sera bientôt disponible.</p>
            </div>
          ) : (
            <div className="producers-grid">
              {producers.map((producer) => (
                <div key={producer.id} className="producer-card">
                  {/* Image placeholder */}
                  <div className="producer-image">
                    {producer.imageUrl ? (
                      <img src={producer.imageUrl} alt={producer.name} />
                    ) : (
                      <div className="image-placeholder">
                        <Sprout size={48} />
                      </div>
                    )}
                    {producer.isBio && (
                      <div className="bio-badge">
                        <Leaf size={16} />
                        <span>Bio</span>
                      </div>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="producer-content">
                    <div className="producer-header">
                      <h3>{producer.name}</h3>
                      {producer.specialty && (
                        <p className="producer-specialty">{producer.specialty}</p>
                      )}
                    </div>

                    {/* Localisation */}
                    {(producer.city || producer.postalCode) && (
                      <div className="producer-location">
                        <MapPin size={16} />
                        <span>
                          {producer.city}
                          {producer.postalCode && ` (${producer.postalCode})`}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    {producer.description && (
                      <p className="producer-description">
                        {producer.description}
                      </p>
                    )}

                    {/* Productions */}
                    {producer.products && producer.products.length > 0 && (
                      <div className="producer-products">
                        <div className="products-label">
                          <Package size={16} />
                          <span>Productions :</span>
                        </div>
                        <div className="products-tags">
                          {producer.products.slice(0, 6).map((product) => (
                            <span key={product.id} className="product-tag">
                              {product.name}
                            </span>
                          ))}
                          {producer.products.length > 6 && (
                            <span className="product-tag more">
                              +{producer.products.length - 6} autres
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Contact */}
                    <div className="producer-contact">
                      {producer.email && (
                        <a 
                          href={`mailto:${producer.email}`}
                          className="contact-link"
                          title="Envoyer un email"
                        >
                          <Mail size={16} />
                          <span>Contact</span>
                        </a>
                      )}
                      {producer.phone && (
                        <a 
                          href={`tel:${producer.phone}`}
                          className="contact-link"
                          title="Appeler"
                        >
                          <Phone size={16} />
                          <span>{producer.phone}</span>
                        </a>
                      )}
                      {producer.website && (
                        <a 
                          href={producer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="contact-link"
                          title="Visiter le site web"
                        >
                          <ExternalLink size={16} />
                          <span>Site web</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Devenir producteur */}
      <section className="join-cta">
        <div className="container">
          <div className="cta-card">
            <div className="cta-icon">
              <Sprout size={48} />
            </div>
            <div className="cta-content">
              <h2>Vous êtes producteur local ?</h2>
              <p>
                Rejoignez notre réseau de producteurs et bénéficiez de débouchés garantis 
                pour vos produits bio et locaux.
              </p>
              <Link href="/devenir-producteur" className="btn btn-primary btn-lg">
                Candidater
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Abonnements */}
      <section className="subscription-cta">
        <div className="container">
          <div className="cta-banner">
            <h2>Envie de soutenir nos producteurs ?</h2>
            <p>
              Abonnez-vous pour recevoir chaque semaine des légumes frais 
              et de saison directement de nos producteurs locaux.
            </p>
            <Link href="/nos-abonnements" className="btn btn-primary btn-lg">
              Découvrir nos abonnements
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}