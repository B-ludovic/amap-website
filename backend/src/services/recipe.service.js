import translate from 'google-translate-api-x';

const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

class RecipeService {

    // Normaliser un terme de recherche (enlever les pluriels, nettoyer)
    normalizeSearchTerm(term) {
        if (!term) return term;
        
        let normalized = term.trim().toLowerCase();
        
        // Enlever le 's' final pour le pluriel français (courgettes -> courgette)
        if (normalized.endsWith('s') && normalized.length > 3) {
            normalized = normalized.slice(0, -1);
        }
        
        // Enlever 'x' final pour certains pluriels (poireaux -> poireau)
        if (normalized.endsWith('x') && normalized.length > 3) {
            normalized = normalized.slice(0, -1);
        }
        
        return normalized;
    }

    // Traduire un texte en français

    async translateToFrench(text) {
        if (!text) return text;
        try {
            const result = await translate(text, { to: 'fr' });
            return result.text;
        } catch (error) {
            console.error('Erreur traduction:', error);
            return text;
        }
    }

    // Extraire les ingrédients d'une recette TheMealDB

    extractIngredients(meal) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            const measure = meal[`strMeasure${i}`];

            if (ingredient && ingredient.trim()) {
                ingredients.push({
                    name: ingredient,
                    measure: measure || ''
                });
            }
        }
        return ingredients;
    }

    // Extraire et traduire les ingrédients d'une recette

    async extractAndTranslateIngredients(meal) {
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            const measure = meal[`strMeasure${i}`];

            if (ingredient && ingredient.trim()) {
                ingredients.push({
                    name: ingredient,
                    measure: measure || ''
                });
            }
        }

        // Traduire tous les ingrédients en parallèle
        const translatedIngredients = await Promise.all(
            ingredients.map(async (ing) => ({
                name: await this.translateToFrench(ing.name),
                measure: ing.measure
            }))
        );

        return translatedIngredients;
    }

    // Recherche de recettes avec traduction

    async searchRecipes(query, number = 12) {
        try {
            // Normaliser la requête (enlever les pluriels)
            const normalizedQuery = this.normalizeSearchTerm(query);

            // Traduire la requête normalisée en anglais pour TheMealDB
            let englishQuery = normalizedQuery;
            try {
                const result = await translate(normalizedQuery, { to: 'en' });
                englishQuery = result.text;
            } catch (error) {
                console.error('Erreur traduction query:', error);
            }

            const urls = [
                `${THEMEALDB_BASE_URL}/search.php?s=${encodeURIComponent(englishQuery)}`
            ];
            if (normalizedQuery.toLowerCase() !== englishQuery.toLowerCase()) {
                urls.push(`${THEMEALDB_BASE_URL}/search.php?s=${encodeURIComponent(normalizedQuery)}`);
            }

            const responses = await Promise.all(urls.map(url => fetch(url)));
            for (const response of responses) {
                if (!response.ok) throw new Error(`TheMealDB API error: ${response.status}`);
            }
            const datasets = await Promise.all(responses.map(r => r.json()));

            const mealsMap = new Map();
            for (const data of datasets) {
                for (const meal of (data.meals || [])) {
                    mealsMap.set(meal.idMeal, meal);
                }
            }
            // Si aucun résultat, essayer en supprimant progressivement le début du mot
            if (mealsMap.size === 0) {
                for (let i = 1; i < englishQuery.length - 3; i++) {
                    const suffix = englishQuery.slice(i);
                    const res = await fetch(`${THEMEALDB_BASE_URL}/search.php?s=${encodeURIComponent(suffix)}`);
                    if (res.ok) {
                        const d = await res.json();
                        if (d.meals && d.meals.length > 0) {
                            for (const meal of d.meals) mealsMap.set(meal.idMeal, meal);
                            break;
                        }
                    }
                }
            }

            if (mealsMap.size === 0) {
                return [];
            }

            // Priorité aux recettes françaises
            const sortedMeals = [...mealsMap.values()].sort((a, b) => {
                if (a.strArea === 'French' && b.strArea !== 'French') return -1;
                if (a.strArea !== 'French' && b.strArea === 'French') return 1;
                return 0;
            });

            const recipes = await Promise.all(
                sortedMeals.slice(0, number).map(async (meal) => {
                    const translatedTitle = await this.translateToFrench(meal.strMeal);

                    return {
                        id: meal.idMeal,
                        title: translatedTitle,
                        image: meal.strMealThumb,
                        readyInMinutes: 30,
                        servings: 4,
                        category: meal.strCategory,
                        area: meal.strArea
                    };
                })
            );

            return recipes;
        } catch (error) {
            console.error('Erreur searchRecipes:', error);
            throw error;
        }
    }

    // Récupérer les détails d'une recette avec traduction

    async getRecipeDetails(recipeId) {
        try {
            const response = await fetch(
                `${THEMEALDB_BASE_URL}/lookup.php?i=${recipeId}`
            );

            if (!response.ok) {
                throw new Error(`TheMealDB API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.meals || data.meals.length === 0) {
                throw new Error('Recipe not found');
            }

            const meal = data.meals[0];

            const [translatedTitle, translatedInstructions, translatedIngredients] = await Promise.all([
                this.translateToFrench(meal.strMeal),
                this.translateToFrench(meal.strInstructions),
                this.extractAndTranslateIngredients(meal)
            ]);

            return {
                id: meal.idMeal,
                title: translatedTitle,
                image: meal.strMealThumb,
                readyInMinutes: 30,
                servings: 4,
                instructions: translatedInstructions,
                extendedIngredients: translatedIngredients,
                sourceUrl: meal.strSource,
                summary: translatedInstructions.substring(0, 200) + '...'
            };
        } catch (error) {
            console.error('Erreur getRecipeDetails:', error);
            throw error;
        }
    }

    // Chercher des recettes par ingrédient principal (recettes françaises en priorité)

    async findByIngredients(ingredients, number = 6) {
        try {
            const mainIngredient = ingredients[0];

            // Normaliser l'ingrédient (enlever les pluriels)
            const normalizedIngredient = this.normalizeSearchTerm(mainIngredient);

            // Traduire l'ingrédient normalisé en anglais pour TheMealDB
            let englishIngredient = normalizedIngredient;
            try {
                const result = await translate(normalizedIngredient, { to: 'en' });
                englishIngredient = result.text;
            } catch (error) {
                console.error('Erreur traduction ingredient:', error);
            }

            // Double requête en parallèle : par ingrédient ET recettes françaises
            const [ingredientResponse, frenchResponse] = await Promise.all([
                fetch(`${THEMEALDB_BASE_URL}/filter.php?i=${encodeURIComponent(englishIngredient)}`),
                fetch(`${THEMEALDB_BASE_URL}/filter.php?a=French`)
            ]);

            if (!ingredientResponse.ok) {
                throw new Error(`TheMealDB API error: ${ingredientResponse.status}`);
            }

            const ingredientData = await ingredientResponse.json();
            const ingredientMeals = ingredientData.meals || [];

            if (ingredientMeals.length === 0) {
                return [];
            }

            // Construire le set des IDs français
            const frenchIds = new Set();
            if (frenchResponse.ok) {
                const frenchData = await frenchResponse.json();
                for (const meal of (frenchData.meals || [])) {
                    frenchIds.add(meal.idMeal);
                }
            }

            // Recettes françaises avec cet ingrédient en premier, puis les autres
            const frenchMatches = ingredientMeals.filter(m => frenchIds.has(m.idMeal));
            const otherMatches = ingredientMeals.filter(m => !frenchIds.has(m.idMeal));
            const prioritized = [...frenchMatches, ...otherMatches].slice(0, number);

            const recipes = await Promise.all(
                prioritized.map(async (meal) => {
                    const translatedTitle = await this.translateToFrench(meal.strMeal);

                    return {
                        id: meal.idMeal,
                        title: translatedTitle,
                        image: meal.strMealThumb,
                        usedIngredientCount: 1,
                        readyInMinutes: 30,
                        servings: 4
                    };
                })
            );

            return recipes;
        } catch (error) {
            console.error('Erreur findByIngredients:', error);
            throw error;
        }
    }

    // Obtenir des suggestions de recettes pour un panier hebdomadaire

    async getSuggestionsForWeeklyBasket(weeklyBasketItems) {
        const ingredients = weeklyBasketItems.map(item => item.product.name);
        const recipes = await this.findByIngredients(ingredients, 6);
        return recipes;
    }
}

export default new RecipeService();