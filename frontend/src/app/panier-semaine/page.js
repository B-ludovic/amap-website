'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShoppingBasket, Calendar, Package, Leaf, Clock, Users, Search, Lightbulb } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import Link from 'next/link';
import '../../styles/public/weekly-basket.css';

export default function WeeklyBasketPublicPage() {
  const [basket, setBasket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('name'); // 'name' ou 'ingredients'
  const { showError } = useModal();

  useEffect(() => {
    fetchCurrentBasket();
  }, []);

  useEffect(() => {
    if (basket) {
      fetchRecipeSuggestions();
    }
  }, [basket]);

  const fetchCurrentBasket = async () => {
    try {
      setLoading(true);
      const response = await api.weeklyBaskets.getCurrent();
      setBasket(response.data);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement du panier');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipeSuggestions = async () => {
    try {
      setLoadingRecipes(true);
      const response = await api.recipes.getSuggestions(basket.id);
      setRecipes(response.data || []);
    } catch (error) {
      console.error('Erreur suggestions:', error);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleManualSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoadingRecipes(true);
      let response;
      
      if (searchMode === 'ingredients') {
        // Recherche par ingrédients (séparés par virgule)
        response = await api.recipes.findByIngredients(searchQuery);
      } else {
        // Recherche par nom de recette
        response = await api.recipes.search(searchQuery);
      }
      
      setRecipes(response.data || []);
    } catch (error) {
      console.error('Erreur recherche:', error);
      showError('Erreur', 'Erreur lors de la recherche de recettes');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const groupByProducer = (items) => {
    const grouped = {};
    
    items.forEach(item => {
      const producerName = item.product.producer.name;
      if (!grouped[producerName]) {
        grouped[producerName] = [];
      }
      grouped[producerName].push(item);
    });

    return grouped;
  };

  const formatQuantity = (quantity, unit) => {
    if (unit === 'KG') {
      return `${quantity.toFixed(2)} kg`.replace('.', ',');
    }
    return `${quantity} pièce${quantity > 1 ? 's' : ''}`;
  };

  const calculateTotalWeight = (items, size) => {
    const field = size === 'SMALL' ? 'quantitySmall' : 'quantityLarge';
    return items.reduce((sum, item) => {
      if (item.product.unit === 'KG') {
        return sum + item[field];
      }
      return sum;
    }, 0).toFixed(2);
  };

  if (loading) {
    return (
      <div className="weekly-basket-public-page">
        <div className="container">
          <div className="loading-state">Chargement du panier...</div>
        </div>
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="weekly-basket-public-page">
        <div className="container">
          <div className="empty-basket">
            <ShoppingBasket size={64} />
            <h2>Aucun panier publié</h2>
            <p>Le panier de la semaine n'est pas encore disponible.</p>
            <p className="empty-subtitle">Revenez bientôt pour découvrir la sélection de légumes frais !</p>
            <Link href="/" className="btn btn-primary">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const groupedItems = groupByProducer(basket.items);

  return (
    <div className="weekly-basket-public-page">
      {/* Hero */}
      <section className="basket-hero">
        <div className="container">
          <div className="basket-hero-content">
            <div className="basket-badge">
              <ShoppingBasket size={20} />
              <span>Panier de la semaine</span>
            </div>
            <h1>Semaine {basket.weekNumber} - {basket.year}</h1>
            <div className="basket-date">
              <Calendar size={20} />
              <span>Distribution : {formatDate(basket.distributionDate)}</span>
            </div>
            <p className="basket-schedule">
              Mercredi de 18h15 à 19h15
            </p>
          </div>
        </div>
      </section>

      {/* Message de la semaine */}
      {basket.notes && (
        <section className="basket-message">
          <div className="container">
            <div className="message-card">
              <div className="message-icon">
                <Leaf size={24} />
              </div>
              <div className="message-content">
                <h3>Le mot de la semaine</h3>
                <p>{basket.notes}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Récapitulatif */}
      <section className="basket-summary">
        <div className="container">
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-icon small">
                <ShoppingBasket size={24} />
              </div>
              <div className="summary-content">
                <h3>Petit Panier</h3>
                <div className="summary-stats">
                  <span className="stat-value">{calculateTotalWeight(basket.items, 'SMALL')} kg</span>
                  <span className="stat-label">de légumes</span>
                </div>
                <div className="summary-stats">
                  <span className="stat-value">{basket.items.length}</span>
                  <span className="stat-label">variétés</span>
                </div>
                <p className="summary-note">2 à 4 kg • Idéal pour 1-2 personnes</p>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon large">
                <ShoppingBasket size={32} />
              </div>
              <div className="summary-content">
                <h3>Grand Panier</h3>
                <div className="summary-stats">
                  <span className="stat-value">{calculateTotalWeight(basket.items, 'LARGE')} kg</span>
                  <span className="stat-label">de légumes</span>
                </div>
                <div className="summary-stats">
                  <span className="stat-value">{basket.items.length}</span>
                  <span className="stat-label">variétés</span>
                </div>
                <p className="summary-note">6 à 8 kg • Idéal pour famille</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Composition par producteur */}
      <section className="basket-composition">
        <div className="container">
          <h2 className="section-title">Composition du panier</h2>

          <div className="producers-list">
            {Object.entries(groupedItems).map(([producerName, items]) => (
              <div key={producerName} className="producer-section">
                <div className="producer-header">
                  <div className="producer-icon">
                    <Leaf size={24} />
                  </div>
                  <div className="producer-info">
                    <h3>{producerName}</h3>
                    {items[0].product.producer.specialty && (
                      <p className="producer-specialty">{items[0].product.producer.specialty}</p>
                    )}
                  </div>
                </div>

                <div className="products-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Petit panier</th>
                        <th>Grand panier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="product-name">
                            <Package size={16} />
                            <span>{item.product.name}</span>
                          </td>
                          <td className="product-quantity small">
                            {formatQuantity(item.quantitySmall, item.product.unit)}
                          </td>
                          <td className="product-quantity large">
                            {formatQuantity(item.quantityLarge, item.product.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suggestions de recettes */}
      <section className="recipe-suggestions">
        <div className="container">
          <h2 className="section-title">Idées recettes avec ce panier</h2>
          
          {loadingRecipes ? (
            <div className="loading-state">Chargement des suggestions...</div>
          ) : recipes.length > 0 ? (
            <div className="recipes-grid">
              {recipes.slice(0, 3).map((recipe) => (
                <Link key={recipe.id} href={`/recettes/${recipe.id}`} className="recipe-card">
                  <div className="recipe-image">
                    <img src={recipe.image} alt={recipe.title} />
                  </div>
                  <div className="recipe-content">
                    <h3>{recipe.title}</h3>
                    <div className="recipe-meta">
                      <span className="meta-item">
                        <Clock size={16} />
                        {recipe.readyInMinutes} min
                      </span>
                      <span className="meta-item">
                        <Users size={16} />
                        {recipe.servings} pers.
                      </span>
                    </div>
                    <div className="used-ingredients">
                      <span className="used-count">
                        {recipe.usedIngredientCount} ingrédient{recipe.usedIngredientCount > 1 ? 's' : ''} du panier
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="no-suggestions-wrapper">
              <p className="no-suggestions">Aucune suggestion disponible pour ce panier</p>
              <div className="manual-search">
                <p className="search-prompt">Recherchez des recettes manuellement :</p>
                
                {/* Toggle recherche par nom ou ingrédients */}
                <div className="search-mode-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${searchMode === 'name' ? 'active' : ''}`}
                    onClick={() => setSearchMode('name')}
                  >
                    Par nom
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${searchMode === 'ingredients' ? 'active' : ''}`}
                    onClick={() => setSearchMode('ingredients')}
                  >
                    Par ingrédients
                  </button>
                </div>

                <form onSubmit={handleManualSearch} className="search-form">
                  <div className="search-input-wrapper">
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder={
                        searchMode === 'ingredients'
                          ? "Ex: tomates, courgettes, oignons..."
                          : "Ex: soupe, gratin, salade..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Rechercher
                  </button>
                </form>
                
                {searchMode === 'ingredients' && (
                  <p className="search-hint">
                    <Lightbulb size={16} />
                    <span>Séparez les ingrédients par des virgules</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {recipes.length > 0 && (
            <div className="cta-center">
              <Link href="/recettes" className="btn btn-secondary">
                Voir toutes les recettes
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="basket-cta">
        <div className="container">
          <div className="cta-card">
            <h2>Envie de profiter de nos paniers chaque semaine ?</h2>
            <p>
              Rejoignez Aux P'tits Pois et recevez des légumes frais et de saison 
              directement de nos producteurs locaux.
            </p>
            <div className="cta-actions">
              <Link href="/nos-abonnements" className="btn btn-primary btn-lg">
                Découvrir nos abonnements
              </Link>
              <Link href="/nos-producteurs" className="btn btn-primary btn-lg">
                Nos producteurs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}