'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, ChefHat, ArrowLeft, Users, Leaf } from 'lucide-react';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import Link from 'next/link';
import '../../../styles/public/recipes-detail.css';

export default function RecipeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { showModal } = useModal();
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (params.id) {
            fetchRecipeDetail();
        }
    }, [params.id]);

    const fetchRecipeDetail = async () => {
        try {
            setLoading(true);
            const response = await api.recipes.getById(params.id);
            setRecipe(response.data);
        } catch (error) {
            showModal('Erreur', 'Une erreur est survenue lors du chargement de la recette.');
            console.error(error);
            router.push('/recettes');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
      <div className="recipe-detail-page">
        <div className="container">
          <div className="loading-state">
            <ChefHat size={48} />
            <p>Chargement de la recette...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="recipe-detail-page">
        <div className="container">
          <div className="empty-state">
            <ChefHat size={64} />
            <h2>Recette introuvable</h2>
            <p>Cette recette n'existe pas ou n'est plus disponible</p>
            <Link href="/recettes" className="btn btn-primary">
              Retour aux recettes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="recipe-detail-page">
      {/* Breadcrumb */}
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Accueil</Link>
          <span>/</span>
          <Link href="/recettes">Recettes</Link>
          <span>/</span>
          <span>{recipe.title}</span>
        </div>
      </div>

      {/* Hero */}
      <section className="recipe-hero">
        <div className="container">
          <button onClick={() => router.back()} className="back-button">
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="recipe-hero-content">
            <div className="recipe-hero-image">
              <img src={recipe.image} alt={recipe.title} />
              {recipe.vegetarian && (
                <div className="badge-vegetarian">
                  <Leaf size={16} />
                  Végétarien
                </div>
              )}
            </div>

            <div className="recipe-hero-info">
              <h1>{recipe.title}</h1>

              <div className="recipe-meta-main">
                {recipe.readyInMinutes && (
                  <div className="meta-card">
                    <Clock size={24} />
                    <div>
                      <span className="meta-value">{recipe.readyInMinutes} min</span>
                      <span className="meta-label">Temps total</span>
                    </div>
                  </div>
                )}

                {recipe.servings && (
                  <div className="meta-card">
                    <Users size={24} />
                    <div>
                      <span className="meta-value">{recipe.servings}</span>
                      <span className="meta-label">Personnes</span>
                    </div>
                  </div>
                )}

                {recipe.pricePerServing && (
                  <div className="meta-card">
                    <ChefHat size={24} />
                    <div>
                      <span className="meta-value">
                        {(recipe.pricePerServing / 100).toFixed(2)}€
                      </span>
                      <span className="meta-label">Par personne</span>
                    </div>
                  </div>
                )}
              </div>

              {recipe.summary && (
                <div 
                  className="recipe-summary"
                  dangerouslySetInnerHTML={{ 
                    __html: recipe.summary.replace(/<a[^>]*>|<\/a>/g, '') 
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="recipe-content">
        <div className="container">
          <div className="recipe-layout">
            {/* Ingrédients */}
            <aside className="recipe-sidebar">
              <div className="ingredients-card">
                <h2>Ingrédients</h2>
                {recipe.extendedIngredients && recipe.extendedIngredients.length > 0 ? (
                  <ul className="ingredients-list">
                    {recipe.extendedIngredients.map((ingredient, index) => (
                      <li key={index}>
                        <span className="ingredient-amount">
                          {ingredient.amount} {ingredient.unit}
                        </span>
                        <span className="ingredient-name">
                          {ingredient.nameClean || ingredient.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-data">Ingrédients non disponibles</p>
                )}
              </div>

              {/* Badges diététiques */}
              {(recipe.vegetarian || recipe.vegan || recipe.glutenFree || recipe.dairyFree) && (
                <div className="dietary-badges">
                  <h3>Régimes alimentaires</h3>
                  <div className="badges-list">
                    {recipe.vegetarian && (
                      <span className="diet-badge">
                        <Leaf size={14} />
                        Végétarien
                      </span>
                    )}
                    {recipe.vegan && (
                      <span className="diet-badge">
                        <Leaf size={14} />
                        Vegan
                      </span>
                    )}
                    {recipe.glutenFree && (
                      <span className="diet-badge">Sans gluten</span>
                    )}
                    {recipe.dairyFree && (
                      <span className="diet-badge">Sans lactose</span>
                    )}
                  </div>
                </div>
              )}
            </aside>

            {/* Instructions */}
            <div className="recipe-main">
              <div className="instructions-card">
                <h2>Préparation</h2>

                {recipe.analyzedInstructions && 
                 recipe.analyzedInstructions.length > 0 && 
                 recipe.analyzedInstructions[0].steps ? (
                  <ol className="instructions-list">
                    {recipe.analyzedInstructions[0].steps.map((step) => (
                      <li key={step.number} className="instruction-step">
                        <div className="step-number">{step.number}</div>
                        <div className="step-content">
                          <p>{step.step}</p>
                          {step.ingredients && step.ingredients.length > 0 && (
                            <div className="step-ingredients">
                              <strong>Ingrédients :</strong>
                              {step.ingredients.map((ing, idx) => (
                                <span key={idx} className="step-ingredient-tag">
                                  {ing.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : recipe.instructions ? (
                  <div 
                    className="instructions-html"
                    dangerouslySetInnerHTML={{ 
                      __html: recipe.instructions 
                    }}
                  />
                ) : (
                  <p className="no-data">Instructions non disponibles</p>
                )}
              </div>

              {/* Informations nutritionnelles */}
              {recipe.nutrition && recipe.nutrition.nutrients && (
                <div className="nutrition-card">
                  <h2>Informations nutritionnelles</h2>
                  <div className="nutrition-grid">
                    {recipe.nutrition.nutrients.slice(0, 6).map((nutrient, index) => (
                      <div key={index} className="nutrition-item">
                        <span className="nutrition-value">
                          {nutrient.amount.toFixed(1)}{nutrient.unit}
                        </span>
                        <span className="nutrition-name">{nutrient.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Source */}
      {recipe.sourceUrl && (
        <section className="recipe-source">
          <div className="container">
            <div className="source-card">
              <p>
                Recette originale disponible sur{' '}
                <a 
                  href={recipe.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  {recipe.sourceName || 'le site source'}
                </a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="recipe-cta">
        <div className="container">
          <div className="cta-card">
            <h2>Découvrez d'autres recettes</h2>
            <p>
              Explorez notre sélection de recettes de saison pour cuisiner 
              les légumes de votre panier
            </p>
            <div className="cta-actions">
              <Link href="/recettes" className="btn btn-primary">
                Toutes les recettes
              </Link>
              <Link href="/panier-semaine" className="btn btn-secondary">
                Panier de la semaine
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}