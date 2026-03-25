'use client';

import { useState, useEffect } from 'react';
import { ShoppingBasket, Calendar, Leaf, LeafyGreen, Apple, Egg, Wheat, Clock, Users, Search, Lightbulb, MapPin } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import Link from 'next/link';
import Image from 'next/image';
import { SEASONAL_VEGETABLES, SEASON_LABELS, getCurrentSeason } from '../../constants/recipes';
import '../../styles/public/weekly-basket.css';

const categoryIcon = (category) => {
  switch (category) {
    case 'FRUITS':    return Apple;
    case 'EGGS':      return Egg;
    case 'GROCERY':   return Wheat;
    case 'VEGETABLES':
    default:          return LeafyGreen;
  }
};

const season = getCurrentSeason();
const seasonalPills = SEASONAL_VEGETABLES[season];

export default function WeeklyBasketPublicPage() {
  const [basket, setBasket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('ingredients');
  const [activePillId, setActivePillId] = useState(null);
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

  const handleSearch = async (query, queryEn = null, mode = null) => {
    const effectiveMode = mode ?? searchMode;
    setLoadingRecipes(true);
    try {
      let response;
      if (effectiveMode === 'ingredients') {
        response = await api.recipes.findByIngredients(query, queryEn);
      } else {
        response = await api.recipes.search(query, queryEn);
      }
      setRecipes(response.data || []);
    } catch (error) {
      console.error('Erreur recherche:', error);
      showError('Erreur', 'Erreur lors de la recherche de recettes');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActivePillId(null);
    handleSearch(searchQuery);
  };

  const handlePillClick = (veg) => {
    setSearchQuery(veg.queryFr);
    setActivePillId(veg.id);
    handleSearch(veg.queryFr, veg.queryEn, 'ingredients');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const groupCatalogueByProducer = (items) => {
    const grouped = {};
    items
      .filter(item => item.product)
      .forEach(item => {
        const producerName = item.product.producer?.name || 'Producteur inconnu';
        if (!grouped[producerName]) {
          grouped[producerName] = { specialty: item.product.producer?.specialty, items: [] };
        }
        grouped[producerName].items.push(item);
      });
    return grouped;
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

  const groupedByProducer = basket ? groupCatalogueByProducer(basket.items) : {};
  const freeItems = basket ? basket.items.filter(item => !item.product && item.customProductName) : [];
  const totalCount = basket ? basket.items.length : 0;

  return (
    <div className="weekly-basket-public-page">

      {basket ? (
        <>
          {/* Hero */}
          <section className="basket-hero">
            <div className="container">
              <div className="basket-hero-content">
                <div className="basket-badge">
                  <ShoppingBasket size={20} aria-hidden="true" />
                  <span>Panier de la semaine</span>
                </div>
                <h1>Semaine {basket.weekNumber} - {basket.year}</h1>
                <div className="basket-date">
                  <Calendar size={20} aria-hidden="true" />
                  <span>Distribution : {formatDate(basket.distributionDate)}</span>
                </div>
                <div className="basket-info-card">
                  <div className="basket-info-item">
                    <Clock size={18} aria-hidden="true" />
                    <span>Mercredi de 18h15 à 19h15</span>
                  </div>
                  <div className="basket-info-divider" />
                  <div className="basket-info-item">
                    <MapPin size={18} aria-hidden="true" />
                    <div>
                      <span>Paroisse Saint François de Sales de Clamart</span>
                      <span className="basket-info-sub">340 Avenue du Général de Gaulle, 92140 Clamart</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Message de la semaine */}
          {basket.notes && (
            <section className="basket-message">
              <div className="container">
                <div className="message-card">
                  <div className="message-icon">
                    <Leaf size={24} aria-hidden="true" />
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
                    <ShoppingBasket size={24} aria-hidden="true" />
                  </div>
                  <div className="summary-content">
                    <h3>Petit Panier</h3>
                    <div className="summary-stats">
                      <span className="stat-value">{totalCount}</span>
                      <span className="stat-label">variété{totalCount > 1 ? 's' : ''}</span>
                    </div>
                    <p className="summary-note">2 à 4 kg • Idéal pour 1-2 personnes</p>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="summary-icon large">
                    <ShoppingBasket size={32} aria-hidden="true" />
                  </div>
                  <div className="summary-content">
                    <h3>Grand Panier</h3>
                    <div className="summary-stats">
                      <span className="stat-value">{totalCount}</span>
                      <span className="stat-label">variété{totalCount > 1 ? 's' : ''}</span>
                    </div>
                    <p className="summary-note">6 à 8 kg • Idéal pour famille</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Composition */}
          <section className="basket-composition">
            <div className="container">
              <h2 className="section-title">Composition du panier</h2>
              <div className="producers-list">
                {Object.entries(groupedByProducer).map(([producerName, group]) => (
                  <div key={producerName} className="producer-section">
                    <div className="producer-header">
                      <div className="producer-icon">
                        <Leaf size={24} aria-hidden="true" />
                      </div>
                      <div className="producer-info">
                        <h3>{producerName}</h3>
                        {group.specialty && (
                          <p className="producer-specialty">{group.specialty}</p>
                        )}
                      </div>
                    </div>
                    <ul className="products-list">
                      {group.items.map((item) => {
                        const Icon = categoryIcon(item.product.category);
                        return (
                          <li key={item.id} className="product-item">
                            <Icon size={16} />
                            <span>{item.product.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {freeItems.length > 0 && (
                  <div className="producer-section">
                    <div className="producer-header">
                      <div className="producer-icon">
                        <Leaf size={24} aria-hidden="true" />
                      </div>
                      <div className="producer-info">
                        <h3>Autres produits</h3>
                      </div>
                    </div>
                    <ul className="products-list">
                      {freeItems.map((item) => (
                        <li key={item.id} className="product-item">
                          <Leaf size={16} aria-hidden="true" />
                          <span>{item.customProductName}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="container">
          <div className="empty-basket">
            <ShoppingBasket size={64} aria-hidden="true" />
            <h2>Aucun panier publié</h2>
            <p>Le panier de la semaine n'est pas encore disponible.</p>
            <p className="empty-subtitle">Revenez bientôt pour découvrir la sélection de légumes frais !</p>
            <Link href="/" className="btn btn-primary">
              Retour à l'accueil
            </Link>
          </div>
        </div>
      )}

      {/* Suggestions de recettes — toujours visible */}
      <section className="recipe-suggestions">
        <div className="container">
          <h2 className="section-title">Idées recettes de saison</h2>

          {/* Barre de recherche */}
          <div className="manual-search">
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
                <Search size={20} aria-hidden="true" />
                <input
                  type="text"
                  placeholder={
                    searchMode === 'ingredients'
                      ? 'Ex : tomates, courgettes, oignons...'
                      : 'Ex : soupe, gratin, salade...'
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setActivePillId(null);
                  }}
                  className="search-input"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Rechercher
              </button>
            </form>

            {/* Pilules saisonnières */}
            <div className="season-pills-container">
              <span className="season-pills-label">
                Suggestions {SEASON_LABELS[season]} :
              </span>
              <div className="season-pills">
                {seasonalPills.map((veg) => (
                  <button
                    key={veg.id}
                    type="button"
                    className={`season-pill ${activePillId === veg.id ? 'active' : ''}`}
                    onClick={() => handlePillClick(veg)}
                  >
                    <Image src={veg.icon} alt="" width={20} height={20} aria-hidden="true" />
                    <span>{veg.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="search-hint" style={{ visibility: searchMode === 'ingredients' ? 'visible' : 'hidden' }}>
              <Lightbulb size={16} aria-hidden="true" />
              <span>Séparez les ingrédients par des virgules</span>
            </p>
          </div>

          {/* Résultats */}
          {loadingRecipes ? (
            <div className="loading-state">Chargement des recettes...</div>
          ) : recipes.length > 0 ? (
            <>
              <div className="recipes-grid">
                {recipes.slice(0, 6).map((recipe) => (
                  <Link key={recipe.id} href={`/recettes/${recipe.id}`} className="recipe-card">
                    <div className="recipe-image">
                      <img src={recipe.image} alt={recipe.title} loading="lazy" />
                    </div>
                    <div className="recipe-content">
                      <h3>{recipe.title}</h3>
                      <div className="recipe-meta">
                        <span className="meta-item">
                          <Clock size={16} aria-hidden="true" />
                          {recipe.readyInMinutes} min
                        </span>
                        <span className="meta-item">
                          <Users size={16} aria-hidden="true" />
                          {recipe.servings} pers.
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="cta-center">
                <Link href="/recettes" className="btn btn-primary">
                  Voir toutes les recettes
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* CTA abonnement — seulement si panier publié */}
      {basket && (
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
      )}
    </div>
  );
}
