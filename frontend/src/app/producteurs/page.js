'use client';

import { useState, useEffect } from 'react';
import ProducerCard from '../../components/producers/ProducerCard';

function ProducteursPage() {
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducers();
  }, []);

  const fetchProducers = async () => {
    setLoading(true);
    try {

      // TODO: Appeler l'API réelle
      // const response = await fetch('http://localhost:4000/api/producers');
      // const data = await response.json();
      
      // Simulation pour l'instant
      setTimeout(() => {
        setProducers([
          {
            id: 1,
            name: 'Ferme des Lilas',
            description: 'Producteur de légumes bio depuis 1985. Nous cultivons plus de 30 variétés de légumes de saison en agriculture biologique.',
            email: 'contact@fermedeslilas.fr',
            phone: '01 45 67 89 01',
            specialty: 'Légumes de saison',
            image: '/icons/tracteur.png'
          },
          {
            id: 2,
            name: 'Les Vergers du Soleil',
            description: 'Fruits et légumes cultivés en agroécologie dans le respect de la nature.',
            email: 'contact@vergersdulsoleil.fr',
            phone: '01 56 78 90 12',
            specialty: 'Fruits et légumes',
            image: '/icons/tree.png'
          },
          {
            id: 3,
            name: 'La Ferme du Bonheur',
            description: 'Producteur local de fromages de chèvre et produits laitiers fermiers.',
            email: 'contact@fermedubonheur.fr',
            phone: '01 67 89 01 23',
            specialty: 'Produits laitiers',
            image: '/icons/goat.png'
          }
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Erreur lors du chargement des producteurs:', error);
      setLoading(false);
    }
  };

  return (
    <div className="producteurs-page">
      <div className="container">
        {/* En-tête de la page */}
        <div className="page-header">
          <h1 className="page-title">Nos Producteurs</h1>
          <p className="page-description">
            Découvrez les producteurs locaux qui cultivent avec passion 
            les produits que vous retrouvez dans vos paniers.
          </p>
        </div>

        {/* Liste des producteurs */}
        {loading ? (
          <div className="loading-container">
            <p>Chargement des producteurs...</p>
          </div>
        ) : producers.length === 0 ? (
          <div className="empty-state">
            <p>Aucun producteur disponible pour le moment.</p>
          </div>
        ) : (
          <div className="producers-grid">
            {producers.map((producer) => (
              <ProducerCard key={producer.id} producer={producer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProducteursPage;