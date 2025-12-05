'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function FeaturedBaskets() {
  const [baskets, setBaskets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Appeler l'API pour récupérer les paniers
    // Simulation pour l'instant
    setTimeout(() => {
      setBaskets([
        {
          id: 1,
          name: 'Panier Découverte',
          description: 'Un panier varié pour découvrir nos produits locaux',
          price: 25.00,
          image: '/icons/panier-decouverte.png'
        },
        {
          id: 2,
          name: 'Panier Famille',
          description: 'Un grand panier pour toute la famille',
          price: 45.00,
          image: '/icons/panier-famille.png'
        },
        {
          id: 3,
          name: 'Panier Fruits',
          description: 'Un panier 100% fruits de saison',
          price: 18.00,
          image: '/icons/panier-fruits.png'
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <section className="featured-baskets">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="featured-baskets">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Nos paniers populaires</h2>
          <p className="section-description">
            Découvrez nos paniers les plus appréciés par nos clients
          </p>
        </div>

        <div className="baskets-grid">
          {baskets.map((basket) => (
            <div key={basket.id} className="basket-card">
              <div className="basket-card-image">
                <Image 
                  src={basket.image} 
                  alt={basket.name}
                  width={80}
                  height={80}
                  className="basket-card-icon"
                />
              </div>
              <div className="basket-card-content">
                <h3 className="basket-card-title">{basket.name}</h3>
                <p className="basket-card-description">{basket.description}</p>
                <div className="basket-card-footer">
                  <span className="basket-card-price">{basket.price.toFixed(2)}€</span>
                  <Link href={`/paniers/${basket.id}`} className="btn btn-primary btn-sm">
                    Voir le panier
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-cta">
          <Link href="/paniers" className="btn btn-secondary btn-lg">
            Voir tous les paniers
          </Link>
        </div>
      </div>
    </section>
  );
}