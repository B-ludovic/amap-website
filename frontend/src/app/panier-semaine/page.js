'use client';

import { Fragment, useState, useEffect } from 'react';
import Link from 'next/link';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import logger from '../../lib/logger';
import { SEASONAL_VEGETABLES, SEASON_LABELS, getCurrentSeason } from '../../constants/recipes';
import { getProductIcon, PRODUCT_CATEGORY_LABELS } from '../../constants/productIcons';
import '../../styles/public/weekly-basket.css';

/* Dates formatées à la main : Intl n'emploie pas les mêmes espaces côté
   serveur et côté navigateur, ce qui casse l'hydratation. */
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/* « mercredi 19 août 2026 » */
function longDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const season = getCurrentSeason();
const seasonalPills = SEASONAL_VEGETABLES[season];

/* Un panier peut mêler produits du catalogue et lignes libres : les premiers
   sont regroupés par producteur, les secondes rassemblées à la fin. */
function groupByProducer(items) {
  const groups = [];
  const byProducer = new Map();

  items.filter(item => item.product).forEach(item => {
    const producer = item.product.producer;
    const key = producer?.id || producer?.name || 'inconnu';
    if (!byProducer.has(key)) {
      const group = {
        key,
        name: producer?.name || 'Producteur inconnu',
        specialty: producer?.specialty || null,
        items: []
      };
      byProducer.set(key, group);
      groups.push(group);
    }
    byProducer.get(key).items.push({
      id: item.id,
      name: item.product.name,
      note: PRODUCT_CATEGORY_LABELS[item.product.category] || null,
      icon: getProductIcon(item.product.name)
    });
  });

  // Le producteur qui fournit le plus gros de la semaine ouvre la liste
  groups.sort((a, b) => b.items.length - a.items.length);

  const free = items.filter(item => !item.product && item.customProductName);
  if (free.length > 0) {
    groups.push({
      key: 'libres',
      name: 'Autres produits',
      specialty: null,
      items: free.map(item => ({
        id: item.id,
        name: item.customProductName,
        note: null,
        icon: getProductIcon(item.customProductName)
      }))
    });
  }

  return groups;
}

export default function WeeklyBasketPublicPage() {
  const [basket, setBasket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('ingredients');
  const [activePillId, setActivePillId] = useState(null);
  const [appliedQuery, setAppliedQuery] = useState('');
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
      logger.error('Erreur suggestions:', error);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleSearch = async (query, queryEn = null, mode = null) => {
    const effectiveMode = mode ?? searchMode;
    setLoadingRecipes(true);
    setAppliedQuery(query);
    try {
      const response = effectiveMode === 'ingredients'
        ? await api.recipes.findByIngredients(query, queryEn)
        : await api.recipes.search(query, queryEn);
      setRecipes(response.data || []);
    } catch (error) {
      logger.error('Erreur recherche:', error);
      showError('Erreur', 'Erreur lors de la recherche de recettes');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActivePillId(null);
    handleSearch(searchQuery.trim());
  };

  const handlePillClick = (veg) => {
    setSearchQuery(veg.queryFr);
    setActivePillId(veg.id);
    setSearchMode('ingredients');
    handleSearch(veg.queryFr, veg.queryEn, 'ingredients');
  };

  const handleReset = () => {
    setSearchQuery('');
    setAppliedQuery('');
    setActivePillId(null);
    if (basket) {
      fetchRecipeSuggestions();
    } else {
      setRecipes([]);
    }
  };

  if (loading) {
    return (
      <div className="basket-page">
        <div className="basket-loading">Chargement du panier</div>
      </div>
    );
  }

  const groups = basket ? groupByProducer(basket.items) : [];
  const varietyCount = basket ? basket.items.length : 0;
  const shownRecipes = recipes.slice(0, 6);

  const resultLabel = appliedQuery
    ? (shownRecipes.length === 0
        ? `Aucune recette pour « ${appliedQuery} »`
        : `${shownRecipes.length} ${shownRecipes.length > 1 ? 'recettes' : 'recette'} pour « ${appliedQuery} »`)
    : (basket
        ? `${shownRecipes.length} ${shownRecipes.length > 1 ? 'suggestions' : 'suggestion'} à partir du panier de la semaine`
        : 'Choisissez un légume ou lancez une recherche');

  return (
    <div className="basket-page">
      {basket ? (
        <>
          <section className="basket-hero">
            <div>
              <div className="basket-badge">
                <span className="live-dot" aria-hidden="true" />
                <span className="basket-badge-text">
                  Panier publié · {varietyCount} variété{varietyCount > 1 ? 's' : ''}
                </span>
              </div>
              <h1 className="basket-title">Semaine {basket.weekNumber} — {basket.year}</h1>
              <p className="basket-date">Distribution le {longDate(basket.distributionDate)}</p>
              <div className="basket-meta">
                <div className="basket-meta-row">
                  <span className="basket-meta-label">Créneau</span>
                  <span className="basket-meta-value">
                    Mercredi de <span className="basket-meta-mono">18h15 à 19h15</span>
                  </span>
                </div>
                <div className="basket-meta-row">
                  <span className="basket-meta-label">Retrait</span>
                  <span className="basket-meta-value">
                    Paroisse Saint François de Sales<br />
                    <span className="basket-meta-sub">340 avenue du Général de Gaulle, 92140 Clamart</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="basket-visual">
              <img
                src="/placeholder/legumes-ete.webp"
                alt="Légumes de saison du panier de la semaine"
              />
            </div>
          </section>

          {basket.notes && (
            <section className="basket-note">
              <div className="basket-note-inner">
                <div className="eyebrow">Le mot de la semaine</div>
                <p className="basket-note-text">{basket.notes}</p>
              </div>
            </section>
          )}

          <section className="basket-compo">
            <div>
              <div className="eyebrow">Composition</div>
              <h2 className="basket-section-title">Qui a cultivé quoi.</h2>

              <div className="basket-groups">
                {groups.map(group => (
                  <div key={group.key}>
                    <div className="basket-group-head">
                      <div>
                        <h3 className="basket-group-name">{group.name}</h3>
                        {group.specialty && (
                          <div className="basket-group-specialty">{group.specialty}</div>
                        )}
                      </div>
                      <span className="basket-group-count">
                        {group.items.length} produit{group.items.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="basket-items">
                      {group.items.map(item => (
                        <li key={item.id} className="basket-item">
                          <span className="basket-item-tile" aria-hidden="true">
                            {item.icon && <img src={item.icon} alt="" />}
                          </span>
                          <span className="basket-item-name">{item.name}</span>
                          {item.note && <span className="basket-item-note">{item.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <aside className="basket-aside">
              <div className="side-card">
                <div className="side-card-head">
                  <h2 className="side-card-title">Ce que vous recevez</h2>
                </div>
                <div className="side-card-body">
                  <div className="side-block">
                    <div className="basket-formula-head">
                      <span className="basket-formula-name">Petit panier</span>
                      <span className="basket-formula-count">
                        {varietyCount} variété{varietyCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="basket-formula-note">2 à 4 kg · pour 1 à 2 personnes</div>
                  </div>
                  <div className="side-block">
                    <div className="basket-formula-head">
                      <span className="basket-formula-name">Grand panier</span>
                      <span className="basket-formula-count">
                        {varietyCount} variété{varietyCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="basket-formula-note">6 à 8 kg · pour une famille</div>
                  </div>
                  <p className="basket-formula-foot">
                    Mêmes variétés dans les deux paniers, seules les quantités changent.
                  </p>
                </div>
              </div>

              <div className="forest-card">
                <div className="eyebrow">Pas encore adhérent</div>
                <p className="forest-card-text">
                  Ce panier part chaque mercredi aux foyers adhérents. Il reste des places
                  pour la saison prochaine.
                </p>
                <Link href="/nos-abonnements" className="basket-join-link">
                  Voir les abonnements
                </Link>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <section className="basket-empty">
          <div className="basket-empty-card">
            <h1 className="basket-empty-title">Le panier n&apos;est pas encore publié.</h1>
            <p className="basket-empty-text">
              La composition de la semaine est mise en ligne quelques jours avant la
              distribution. En attendant, les idées recettes plus bas restent à votre
              disposition.
            </p>
            <Link href="/" className="basket-cta-primary">Retour à l&apos;accueil</Link>
          </div>
        </section>
      )}

      <section className="basket-recipes">
        <div className="basket-recipes-inner">
          <div className="basket-recipes-head">
            <div className="eyebrow">Idées recettes · suggestions {SEASON_LABELS[season].toLowerCase()}</div>
            <h2 className="basket-section-title">Qu&apos;est-ce qu&apos;on en fait ?</h2>
            <p className="basket-recipes-lede">
              Cherchez par ingrédient du panier, ou par nom de plat si vous avez déjà une idée.
            </p>
          </div>

          <div className="basket-modes">
            <button
              type="button"
              className={`basket-mode ${searchMode === 'ingredients' ? 'is-active' : ''}`}
              onClick={() => setSearchMode('ingredients')}
            >
              Par ingrédients
            </button>
            <button
              type="button"
              className={`basket-mode ${searchMode === 'name' ? 'is-active' : ''}`}
              onClick={() => setSearchMode('name')}
            >
              Par nom
            </button>
          </div>

          <form onSubmit={handleManualSearch} className="basket-search">
            <input
              type="text"
              className="input"
              placeholder={
                searchMode === 'ingredients'
                  ? 'Ex : tomate, courgette, aubergine…'
                  : 'Ex : gratin, soupe, tarte…'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActivePillId(null);
              }}
              aria-label="Rechercher une recette"
            />
            <button type="submit" className="basket-search-submit" disabled={loadingRecipes}>
              Rechercher
            </button>
          </form>

          <div className="basket-pills">
            <span className="basket-pills-label">Légumes du moment</span>
            <div className="basket-pills-list">
              {seasonalPills.map(veg => (
                <button
                  key={veg.id}
                  type="button"
                  className={`basket-pill ${activePillId === veg.id ? 'is-active' : ''}`}
                  onClick={() => handlePillClick(veg)}
                >
                  <img src={veg.icon} alt="" aria-hidden="true" />
                  <span>{veg.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="basket-results">
            <span className="basket-results-label">
              {loadingRecipes ? 'Recherche en cours…' : resultLabel}
            </span>
            {appliedQuery && (
              <button type="button" className="basket-reset" onClick={handleReset}>
                Réinitialiser
              </button>
            )}
          </div>

          {shownRecipes.length > 0 ? (
            <>
              <div className="basket-recipes-grid">
                {shownRecipes.map(recipe => {
                  const tags = (recipe.matchedIngredients || []).join(' · ');
                  const meta = [recipe.categoryLabel, recipe.areaLabel].filter(Boolean);
                  return (
                    <Link
                      key={recipe.id}
                      href={`/recettes/${recipe.id}`}
                      className="basket-recipe"
                    >
                      <img
                        className="basket-recipe-image"
                        src={recipe.image}
                        alt={recipe.title}
                        loading="lazy"
                      />
                      <div className="basket-recipe-body">
                        <h3 className="basket-recipe-title">{recipe.title}</h3>
                        {tags && <div className="basket-recipe-tags">{tags}</div>}
                        {(meta.length > 0 || recipe.isVegetarian) && (
                          <div className="basket-recipe-foot">
                            {meta.map((value, index) => (
                              <Fragment key={value}>
                                {index > 0 && (
                                  <span className="basket-recipe-sep" aria-hidden="true">·</span>
                                )}
                                <span className="basket-recipe-meta">{value}</span>
                              </Fragment>
                            ))}
                            {recipe.isVegetarian && (
                              <span className="basket-recipe-veggie">Végé</span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="basket-recipes-all">
                <Link href="/recettes" className="link-underline">Toutes les recettes</Link>
              </div>
            </>
          ) : !loadingRecipes && (appliedQuery || basket) && (
            <div className="basket-recipes-empty">
              <div className="basket-recipes-empty-title">Rien trouvé pour cette recherche</div>
              <p className="basket-recipes-empty-text">
                Essayez un légume du panier — ou cherchez par nom de plat : gratin, soupe, tarte.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="basket-cta">
        <div className="basket-cta-card">
          <div>
            <h2 className="basket-cta-title">Ce panier, chaque mercredi.</h2>
            <p className="basket-cta-text">
              Un contrat à l&apos;année, un prix qui ne bouge pas, et des légumes que vous
              voyez pousser à trente kilomètres.
            </p>
          </div>
          <div className="basket-cta-actions">
            <Link href="/nos-abonnements" className="basket-cta-primary">
              Découvrir nos abonnements
            </Link>
            <Link href="/nos-producteurs" className="basket-cta-secondary">
              Nos producteurs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
