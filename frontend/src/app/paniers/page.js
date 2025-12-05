'use client';

import { useState, useEffect } from 'react';
import BasketCard from '../../components/baskets/BasketCard';
import BasketFilters from '../../components/baskets/BasketFilters';

function PaniersPage() {
  const [baskets, setBaskets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    priceRange: 'all',
    sortBy: 'name'
  });

  useEffect(() => {
    fetchBaskets();
  }, [filters]);

  const fetchBaskets = async () => {
    setLoading(true);
    try {
      // TODO: Appeler l'API réelle
      // const response = await fetch('http://localhost:4000/api/baskets');
      // const data = await response.json();
      
      // Simulation pour l'instant
      setTimeout(() => {
        setBaskets([
          {
            id: 1,
            name: 'Panier Découverte',
            description: 'Un panier varié pour découvrir nos produits locaux. Idéal pour 2 personnes.',
            price: 25.00,
            image: '/icons/panier-decouverte.png',
            products: [
              { name: 'Carottes', quantity: 1.5, unit: 'kg' },
              { name: 'Tomates', quantity: 1.0, unit: 'kg' },
              { name: 'Salade', quantity: 2, unit: 'pièce' }
            ]
          },
          {
            id: 2,
            name: 'Panier Famille',
            description: 'Un grand panier pour toute la famille. Pour 4 à 5 personnes.',
            price: 45.00,
            image: '/icons/panier-famille.png',
            products: [
              { name: 'Carottes', quantity: 2.5, unit: 'kg' },
              { name: 'Tomates', quantity: 2.0, unit: 'kg' },
              { name: 'Pommes', quantity: 2.0, unit: 'kg' }
            ]
          },
          {
            id: 3,
            name: 'Panier Fruits',
            description: 'Un panier 100% fruits de saison.',
            price: 18.00,
            image: '/icons/panier-fruits.png',
            products: [
              { name: 'Pommes', quantity: 2.0, unit: 'kg' },
              { name: 'Poires', quantity: 2.0, unit: 'kg' }
            ]
          },
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Erreur lors du chargement des paniers:', error);
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters({ ...filters, ...newFilters });
  };

  return (
    <div className="paniers-page">
      <div className="container">
        {/* En-tête de la page */}
        <div className="page-header">
          <h1 className="page-title">Nos Paniers</h1>
          <p className="page-description">
            Découvrez notre sélection de paniers composés de produits frais, 
            locaux et de saison.
          </p>
        </div>

        {/* Filtres */}
        <BasketFilters 
          filters={filters} 
          onFilterChange={handleFilterChange} 
        />

        {/* Liste des paniers */}
        {loading ? (
          <div className="loading-container">
            <p>Chargement des paniers...</p>
          </div>
        ) : baskets.length === 0 ? (
          <div className="empty-state">
            <p>Aucun panier disponible pour le moment.</p>
          </div>
        ) : (
          <div className="baskets-grid">
            {baskets.map((basket) => (
              <BasketCard key={basket.id} basket={basket} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PaniersPage;