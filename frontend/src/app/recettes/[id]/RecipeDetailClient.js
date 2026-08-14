'use client';

import { Fragment, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import logger from '../../../lib/logger';
import { SEASON_LABELS, getCurrentSeason } from '../../../constants/recipes';
import { isProduce } from '../../../constants/productIcons';
import '../../../styles/public/recipes-detail.css';

const season = getCurrentSeason();

/* « Œufs fermiers » → « oeuf fermier » : minuscules, sans accent, au singulier.
   Sert à rapprocher les ingrédients de la recette des produits du panier. */
const normalize = (value) =>
  String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => (word.length > 3 && /(s|x)$/.test(word) ? word.slice(0, -1) : word))
    .join(' ');

/* Produits du panier que cette recette utilise réellement */
function matchBasketProducts(ingredients, basket) {
  if (!basket) return [];

  const needles = ingredients.map(ing => normalize(ing.name)).filter(n => n.length >= 3);
  const found = [];

  basket.items.forEach(item => {
    const label = item.product?.name || item.customProductName;
    if (!label) return;
    const product = normalize(label);
    if (product.length < 3 || found.includes(label)) return;
    if (needles.some(n => n.includes(product) || product.includes(n))) found.push(label);
  });

  return found;
}

/* « Tomates, Œufs et Betteraves » */
function joinNames(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

const pad = (value) => (value < 10 ? `0${value}` : String(value));

export default function RecipeDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { showModal } = useModal();
  const [recipe, setRecipe] = useState(null);
  const [basket, setBasket] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchRecipeDetail();
      fetchCurrentBasket();
    }
  }, [params.id]);

  const fetchRecipeDetail = async () => {
    try {
      setLoading(true);
      const response = await api.recipes.getById(params.id);
      setRecipe(response.data);
    } catch (error) {
      showModal('Erreur', 'Une erreur est survenue lors du chargement de la recette.');
      logger.error(error);
      router.push('/recettes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentBasket = async () => {
    try {
      const response = await api.weeklyBaskets.getCurrent();
      setBasket(response.data);
    } catch (error) {
      logger.error('Erreur panier:', error);
    }
  };

  /* Les autres idées viennent du panier quand il est publié, sinon du premier
     ingrédient de la recette affichée. */
  useEffect(() => {
    if (!recipe) return;

    const fetchOthers = async () => {
      try {
        // Sans panier publié, on part d'un légume de la recette plutôt que du
        // premier ingrédient venu, souvent une huile ou un condiment.
        const names = (recipe.extendedIngredients || []).map(ing => ing.name);
        const seed = names.find(isProduce) || names[0] || recipe.title;

        const response = basket
          ? await api.recipes.getSuggestions(basket.id)
          : await api.recipes.findByIngredients(seed);
        const list = (response.data || []).filter(item => String(item.id) !== String(recipe.id));
        setOthers(list.slice(0, 3));
      } catch (error) {
        logger.error('Erreur suggestions:', error);
        setOthers([]);
      }
    };

    fetchOthers();
  }, [recipe, basket]);

  if (loading) {
    return (
      <div className="recipe-page">
        <div className="recipe-state">
          <span className="recipe-state-label">Chargement de la recette</span>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="recipe-page">
        <div className="recipe-state">
          <h1 className="recipe-state-title">Recette introuvable.</h1>
          <p className="recipe-state-text">
            Cette recette n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <Link href="/recettes" className="btn-cta btn-cta-primary">Retour aux recettes</Link>
        </div>
      </div>
    );
  }

  const ingredients = recipe.extendedIngredients || [];
  const steps = recipe.steps || [];
  const diets = [
    recipe.isVegetarian && !recipe.isVegan && 'Végétarien',
    recipe.isVegan && 'Végétalien'
  ].filter(Boolean);
  const inBasket = matchBasketProducts(ingredients, basket);
  const kind = recipe.categoryLabel || recipe.areaLabel || '—';

  return (
    <div className="recipe-page">
      <nav className="recipe-crumbs" aria-label="Fil d'Ariane">
        <Link href="/" className="recipe-crumb">Accueil</Link>
        <span className="recipe-crumb-sep" aria-hidden="true">/</span>
        <Link href="/recettes" className="recipe-crumb">Recettes</Link>
        <span className="recipe-crumb-sep" aria-hidden="true">/</span>
        <span className="recipe-crumb-current">{recipe.title}</span>
      </nav>

      <section className="recipe-hero">
        <div className="recipe-hero-visual">
          <img src={recipe.image} alt={recipe.title} />
          {recipe.isVegetarian && (
            <span className="badge-veggie recipe-hero-badge">
              {recipe.isVegan ? 'Végétalien' : 'Végétarien'}
            </span>
          )}
        </div>

        <div>
          <div className="eyebrow">Recette de saison · {SEASON_LABELS[season]}</div>
          <h1 className="recipe-title">{recipe.title}</h1>

          <div className="recipe-figures">
            <div className="recipe-figure">
              <div className="recipe-figure-label">Ingrédients</div>
              <div className="recipe-figure-value">{pad(ingredients.length)}</div>
            </div>
            <div className="recipe-figure">
              <div className="recipe-figure-label">Étapes</div>
              <div className="recipe-figure-value">{pad(steps.length)}</div>
            </div>
            <div className="recipe-figure">
              <div className="recipe-figure-label">Type</div>
              <div className="recipe-figure-value is-brass">{kind}</div>
            </div>
          </div>

          {inBasket.length > 0 && (
            <div className="recipe-hero-note">
              <span className="recipe-hero-dot" aria-hidden="true" />
              <span className="recipe-hero-note-text">
                {joinNames(inBasket)} {inBasket.length > 1 ? 'sont' : 'est'} dans le panier
                de la semaine {basket.weekNumber}.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="recipe-body">
        <aside className="recipe-aside">
          <div className="side-card">
            <div className="side-card-head">
              <h2 className="side-card-title">Ingrédients</h2>
            </div>
            <div className="side-card-body">
              {ingredients.map((ingredient, index) => (
                <div key={`${ingredient.name}-${index}`} className="recipe-ingredient">
                  <span className="recipe-ingredient-amount">{ingredient.measure || '—'}</span>
                  <span className="recipe-ingredient-name">{ingredient.name}</span>
                </div>
              ))}
              <p className="recipe-aside-note">Quantités telles que publiées par la source.</p>
            </div>
          </div>

          {diets.length > 0 && (
            <div className="recipe-diets">
              <div className="eyebrow">Régimes alimentaires</div>
              <div className="recipe-diets-list">
                {diets.map(diet => (
                  <span key={diet} className="badge-veggie">{diet}</span>
                ))}
              </div>
            </div>
          )}

          {inBasket.length > 0 && (
            <div className="side-card">
              <div className="side-card-head">
                <h2 className="side-card-title">Dans le panier</h2>
              </div>
              <div className="side-card-body">
                {inBasket.map(name => (
                  <div key={name} className="recipe-inbasket-row">
                    <span className="recipe-inbasket-dot" aria-hidden="true" />
                    <span className="recipe-inbasket-name">{name}</span>
                  </div>
                ))}
                <p className="recipe-inbasket-foot">
                  <span>Semaine {basket.weekNumber}</span>
                  <Link href="/panier-semaine" className="link-underline">Voir le panier</Link>
                </p>
              </div>
            </div>
          )}
        </aside>

        <div className="recipe-main">
          <div className="eyebrow">Préparation</div>
          <h2 className="recipe-h2">
            {steps.length > 1
              ? `${steps.length} étapes, dans cet ordre.`
              : 'La marche à suivre.'}
          </h2>

          {steps.length > 1 ? (
            <ol className="recipe-steps">
              {steps.map((step, index) => (
                <li key={index} className="recipe-step">
                  <div className="recipe-step-number">{pad(index + 1)}</div>
                  <div>
                    <p className="recipe-step-text">{step.text}</p>
                    {step.ingredients?.length > 0 && (
                      <div className="recipe-step-tags">
                        {step.ingredients.map(name => (
                          <span key={name} className="recipe-step-tag">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="recipe-plain">{steps[0]?.text || recipe.instructions}</p>
          )}

          {recipe.sourceUrl && (
            <p className="recipe-source">
              Source :{' '}
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                {recipe.sourceUrl}
              </a>
            </p>
          )}
        </div>
      </section>

      {others.length > 0 && (
        <section className="recipe-others">
          <div className="recipe-others-inner">
            <div className="recipe-others-head">
              <div>
                <div className="eyebrow">
                  {basket ? 'Avec le reste du panier' : 'Dans le même esprit'}
                </div>
                <h2 className="recipe-h2">
                  {others.length > 1 ? `${others.length} autres idées.` : 'Une autre idée.'}
                </h2>
              </div>
              <Link href="/recettes" className="link-underline">Toutes les recettes</Link>
            </div>

            <div className="recipe-others-grid">
              {others.map(other => {
                const tags = (other.matchedIngredients || []).join(' · ');
                const meta = [other.categoryLabel, other.areaLabel].filter(Boolean);
                return (
                  <Link key={other.id} href={`/recettes/${other.id}`} className="recipe-card">
                    <img
                      className="recipe-card-image"
                      src={other.image}
                      alt={other.title}
                      loading="lazy"
                    />
                    <div className="recipe-card-body">
                      <h3 className="recipe-card-title">{other.title}</h3>
                      {tags && <div className="recipe-card-tags">{tags}</div>}
                      {(meta.length > 0 || other.isVegetarian) && (
                        <div className="recipe-card-foot">
                          {meta.map((value, index) => (
                            <Fragment key={value}>
                              {index > 0 && (
                                <span className="recipe-card-sep" aria-hidden="true">·</span>
                              )}
                              <span className="recipe-card-meta">{value}</span>
                            </Fragment>
                          ))}
                          {other.isVegetarian && (
                            <span className="recipe-card-veggie">Végé</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="recipe-cta">
        <div className="recipe-cta-card">
          <div>
            <h2 className="recipe-cta-title">Ces légumes viennent d&apos;ici.</h2>
            <p className="recipe-cta-text">
              Les légumes de saison de cette recette se retrouvent dans le panier de la
              semaine, cultivés à moins de 30 km de Clamart.
            </p>
          </div>
          <div className="recipe-cta-actions">
            <Link href="/panier-semaine" className="btn-cta btn-cta-primary">Voir le panier</Link>
            <Link href="/nos-abonnements" className="btn-cta btn-cta-ghost">Nos abonnements</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
