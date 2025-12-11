'use client';

import { useState } from 'react';
import { Search, Clock, Users, ChefHat } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import Link from 'next/link';
import '../../styles/public/recipes.css';

export default function RecipesPage() {
    const [query, setQuery] = useState('');
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(false);
    const { showModal } = useModal();

    const handleSearch = async (e) => {
        e.preventDefault();

        if (!query.trim()) {
            showModal('Erreur', 'Veuillez entrer un terme de recherche.');
            return;
        }

        try {
            setLoading(true);
            const response = await api.recipes.search(query);
            setRecipes(response.data);
        } catch (error) {
            showModal('Erreur', 'Une erreur est survenue lors de la recherche.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="recipes-page">
            {/* Hero */}
            <section className="recipes-hero">
                <div className="container">
                    <h1>Recettes</h1>
                    <p className="hero-subtitle">
                        Découvrez des idées de recettes pour cuisiner les légumes de saison
                    </p>
                </div>
            </section>

            {/* Recherche */}
            <section className="recipes-search">
                <div className="container">
                    <form onSubmit={handleSearch} className="search-form">
                        <div className="search-input-wrapper">
                            <Search size={20} />
                            <input
                                type="text"
                                placeholder="Rechercher une recette (ex: soupe de légumes)..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </button>
                    </form>

                    <div className="search-suggestions">
                        <p>Suggestions :</p>
                        <div className="suggestion-tags">
                            <button onClick={() => { setQuery('soupe légumes'); handleSearch({ preventDefault: () => { } }); }}>
                                Soupe de légumes
                            </button>
                            <button onClick={() => { setQuery('tarte légumes'); handleSearch({ preventDefault: () => { } }); }}>
                                Tarte aux légumes
                            </button>
                            <button onClick={() => { setQuery('gratin'); handleSearch({ preventDefault: () => { } }); }}>
                                Gratin
                            </button>
                            <button onClick={() => { setQuery('salade'); handleSearch({ preventDefault: () => { } }); }}>
                                Salade
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Résultats */}
            <section className="recipes-results">
                <div className="container">
                    {loading ? (
                        <div className="loading-state">
                            <ChefHat size={48} />
                            <p>Recherche de recettes en cours...</p>
                        </div>
                    ) : recipes.length === 0 ? (
                        <div className="empty-state">
                            <ChefHat size={64} />
                            <h3>Aucune recette trouvée</h3>
                            <p>Essayez avec d'autres termes de recherche</p>
                        </div>
                    ) : (
                        <>
                            <h2>{recipes.length} recette{recipes.length > 1 ? 's' : ''} trouvée{recipes.length > 1 ? 's' : ''}</h2>
                            <div className="recipes-grid">
                                {recipes.map((recipe) => (
                                    <Link key={recipe.id} href={`/recettes/${recipe.id}`} className="recipe-card">
                                        <div className="recipe-image">
                                            <img src={recipe.image} alt={recipe.title} />
                                        </div>
                                        <div className="recipe-content">
                                            <h3>{recipe.title}</h3>
                                            <div className="recipe-meta">
                                                {recipe.readyInMinutes && (
                                                    <span className="meta-item">
                                                        <Clock size={16} />
                                                        {recipe.readyInMinutes} min
                                                    </span>
                                                )}
                                                {recipe.servings && (
                                                    <span className="meta-item">
                                                        <Users size={16} />
                                                        {recipe.servings} pers.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* CTA */}
            <section className="recipes-cta">
                <div className="container">
                    <div className="cta-card">
                        <h2>Cuisinez les légumes de saison</h2>
                        <p>
                            Découvrez chaque semaine des idées de recettes adaptées
                            au contenu de votre panier
                        </p>
                        <Link href="/panier-semaine" className="btn btn-primary btn-lg">
                            Voir le panier de la semaine
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}