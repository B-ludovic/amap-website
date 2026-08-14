import translate from 'google-translate-api-x';

const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

// Dictionnaire de secours pour les faux amis courants (légumes, fruits, etc.)
const TRANSLATION_OVERRIDES = {
    'lentille': 'lentil',
    'courgette': 'zucchini',
    'aubergine': 'eggplant',
    'chou': 'cabbage',
    'chou-fleur': 'cauliflower',
    'champignon': 'mushroom',
    'poireau': 'leek',
    'navet': 'turnip',
    'panais': 'parsnip',
    'betterave': 'beetroot',
    'haricot': 'bean',
    'petit pois': 'pea',
    'poivron': 'bell pepper',
    'oignon': 'onion',
    'ail': 'garlic',
    'echalote': 'shallot',
    'épinard': 'spinach',
    'bette': 'chard',
    'radis': 'radish',
    'concombre': 'cucumber',
    'potiron': 'pumpkin',
    'courge': 'squash',
    'fenouil': 'fennel',
    'artichaut': 'artichoke',
    'asperge': 'asparagus',
    'endive': 'endive',
    'maïs': 'corn',
};

// TheMealDB ne renvoie ni temps de préparation ni nombre de parts : les seules
// métadonnées réelles sont la catégorie et l'origine du plat. Elles sont
// traduites par table pour rester déterministes (pas d'appel réseau).
const MEAL_CATEGORY_FR = {
    Beef: 'Bœuf',
    Breakfast: 'Petit-déjeuner',
    Chicken: 'Poulet',
    Dessert: 'Dessert',
    Goat: 'Chèvre',
    Lamb: 'Agneau',
    Miscellaneous: 'Plat varié',
    Pasta: 'Pâtes',
    Pork: 'Porc',
    Seafood: 'Produits de la mer',
    Side: 'Accompagnement',
    Starter: 'Entrée',
    Vegan: 'Végétalien',
    Vegetarian: 'Végétarien',
};

// TheMealDB déclare près de 200 origines : seules les plus courantes sont
// traduites, les autres ne sont simplement pas affichées.
const MEAL_AREA_FR = {
    Algerian: 'Algérienne',
    American: 'Américaine',
    Argentine: 'Argentine',
    Australian: 'Australienne',
    Austrian: 'Autrichienne',
    Belgian: 'Belge',
    Brazilian: 'Brésilienne',
    British: 'Britannique',
    Canadian: 'Canadienne',
    Chilean: 'Chilienne',
    Chinese: 'Chinoise',
    Colombian: 'Colombienne',
    Croatian: 'Croate',
    Cuban: 'Cubaine',
    Czech: 'Tchèque',
    Danish: 'Danoise',
    Dutch: 'Néerlandaise',
    Egyptian: 'Égyptienne',
    Filipino: 'Philippine',
    Finnish: 'Finlandaise',
    French: 'Française',
    German: 'Allemande',
    Greek: 'Grecque',
    Hungarian: 'Hongroise',
    Indian: 'Indienne',
    Indonesian: 'Indonésienne',
    Iranian: 'Iranienne',
    Irish: 'Irlandaise',
    Israeli: 'Israélienne',
    Italian: 'Italienne',
    Jamaican: 'Jamaïcaine',
    Japanese: 'Japonaise',
    Kenyan: 'Kényane',
    Lebanese: 'Libanaise',
    Malaysian: 'Malaisienne',
    Mexican: 'Mexicaine',
    Moroccan: 'Marocaine',
    Norwegian: 'Norvégienne',
    Peruvian: 'Péruvienne',
    Polish: 'Polonaise',
    Portuguese: 'Portugaise',
    Romanian: 'Roumaine',
    Russian: 'Russe',
    Senegalese: 'Sénégalaise',
    Serbian: 'Serbe',
    Singaporean: 'Singapourienne',
    'South African': 'Sud-africaine',
    'South Korean': 'Coréenne',
    Spanish: 'Espagnole',
    Swedish: 'Suédoise',
    Swiss: 'Suisse',
    Syrian: 'Syrienne',
    Taiwanese: 'Taïwanaise',
    Thai: 'Thaïlandaise',
    Tunisian: 'Tunisienne',
    Turkish: 'Turque',
    Ukrainian: 'Ukrainienne',
    Uruguayan: 'Uruguayenne',
    Venezuelan: 'Vénézuélienne',
    Vietnamese: 'Vietnamienne',
};

const VEGETARIAN_CATEGORIES = ['Vegetarian', 'Vegan'];

// Les quantités de TheMealDB ne sont pas traduites : seules les unités et les
// mentions courantes le sont, mot à mot. Le reste passe tel quel.
const MEASURE_WORDS_FR = [
    [/\btablespoons?\b|\btblsp\b|\btbsp\b|\btbs\b/gi, 'c. à s.'],
    [/\bteaspoons?\b|\btsp\b|\btspn\b/gi, 'c. à c.'],
    [/\bcups?\b/gi, 'tasse'],
    [/\bcloves?\b/gi, 'gousse'],
    [/\bslices?\b/gi, 'tranche'],
    [/\bsliced\b/gi, 'émincé'],
    [/\bpeeled\b/gi, 'épluché'],
    [/\bdiced\b|\bcubed\b/gi, 'en dés'],
    [/\bcrushed\b/gi, 'écrasé'],
    [/\bground\b/gi, 'moulu'],
    [/\bfresh\b/gi, 'frais'],
    [/\bdried\b/gi, 'séché'],
    [/\bboneless\b/gi, 'désossé'],
    [/\bskinless\b/gi, 'sans peau'],
    [/\bpinch(es)?\b/gi, 'pincée'],
    [/\bdash(es)?\b/gi, 'trait'],
    [/\bhandfuls?\b/gi, 'poignée'],
    [/\bbunch(es)?\b/gi, 'botte'],
    [/\bsprigs?\b/gi, 'brin'],
    [/\bcans?\b|\btins?\b/gi, 'boîte'],
    [/\bjars?\b/gi, 'bocal'],
    [/\bpackets?\b|\bpacks?\b|\bbags?\b/gi, 'sachet'],
    [/\bbottles?\b/gi, 'bouteille'],
    [/\bsheets?\b/gi, 'feuille'],
    [/\bpounds?\b|\blbs?\b/gi, 'livre'],
    [/\bto taste\b|\bto serve\b|\bas required\b|\bas needed\b/gi, 'q.s.'],
    [/\bzest of\b/gi, 'zeste de'],
    [/\bjuice of\b/gi, 'jus de'],
    [/\bzest\b/gi, 'zeste'],
    [/\bfinely\b/gi, 'finement'],
    [/\broughly\b/gi, 'grossièrement'],
    [/\blarge\b/gi, 'grand'],
    [/\bmedium\b/gi, 'moyen'],
    [/\bsmall\b/gi, 'petit'],
    [/\bwhole\b/gi, 'entier'],
    [/\bchopped\b|\bfinely chopped\b/gi, 'haché'],
    [/\bgrated\b/gi, 'râpé'],
    [/\bminced\b/gi, 'émincé'],
    [/\bbeaten\b/gi, 'battu'],
    [/\bmelted\b/gi, 'fondu'],
    [/\btopping\b/gi, 'garniture'],
    [/\bgarnish\b/gi, 'décoration'],
    [/\bdrizzle\b/gi, 'filet'],
    [/\bsprinkling\b/gi, 'saupoudrage'],
    [/\bfor frying\b|\bfor deep frying\b/gi, 'pour la friture'],
    [/\bfor dusting\b/gi, 'pour saupoudrer'],
];

class RecipeService {

    // Métadonnées affichables d'un plat : catégorie et origine traduites
    mealMeta(meal) {
        return {
            category: meal.strCategory || null,
            categoryLabel: MEAL_CATEGORY_FR[meal.strCategory] || meal.strCategory || null,
            area: meal.strArea || null,
            areaLabel: MEAL_AREA_FR[meal.strArea] || null,
            isVegetarian: VEGETARIAN_CATEGORIES.includes(meal.strCategory),
            isVegan: meal.strCategory === 'Vegan',
        };
    }

    // « 2 tblsp » → « 2 c. à s. » ; ce qui n'est pas reconnu reste intact
    localizeMeasure(measure) {
        if (!measure) return '';
        return MEASURE_WORDS_FR
            .reduce((acc, [pattern, fr]) => acc.replace(pattern, fr), measure)
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* Les instructions arrivent en un seul champ, découpé par des sauts de ligne
       — mais pas toujours : certaines fiches tiennent en un bloc. On découpe donc
       AVANT traduction (le traducteur écrase les sauts de ligne), avec un repli
       par phrases groupées pour les fiches d'un seul tenant. */
    splitInstructions(raw) {
        if (!raw) return [];

        // « STEP 1 », « 1. », « 2) » en tête de ligne : notre numérotation les remplace
        const lines = raw
            .replace(/\r\n|\r/g, '\n')
            .split(/\n+/)
            .map(line => line.trim().replace(/^(step\s*\d+\s*[:.)-]?\s*|\d+\s*[.)]\s*)/i, '').trim())
            .filter(Boolean);

        if (lines.length > 1) return lines;

        const single = lines[0] || raw.trim();
        if (single.length < 400) return single ? [single] : [];

        // Un pavé unique : regroupé trois phrases par étape, faute de mieux
        const sentences = single.match(/[^.!?]+[.!?]+(\s|$)/g) || [single];
        const steps = [];
        for (let i = 0; i < sentences.length; i += 3) {
            const chunk = sentences.slice(i, i + 3).join('').trim();
            if (chunk) steps.push(chunk);
        }
        return steps;
    }

    // Liste des ingrédients bruts (anglais) d'un plat, en minuscules
    rawIngredientNames(meal) {
        const names = [];
        for (let i = 1; i <= 20; i++) {
            const ingredient = meal[`strIngredient${i}`];
            if (ingredient && ingredient.trim()) {
                names.push(ingredient.trim().toLowerCase());
            }
        }
        return names;
    }

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

    // Normaliser un terme anglais après traduction (enlever les pluriels anglais)
    normalizeEnglishTerm(term) {
        if (!term) return term;
        let normalized = term.trim().toLowerCase();
        // Enlever le 's' final (lentils -> lentil, carrots -> carrot)
        if (normalized.endsWith('s') && normalized.length > 3) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    // Traduire un terme français en anglais avec dictionnaire de secours
    async translateIngredient(frenchTerm) {
        const normalized = this.normalizeSearchTerm(frenchTerm);

        // Vérifier le dictionnaire de secours en premier
        if (TRANSLATION_OVERRIDES[normalized]) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Recettes] Dictionnaire: "${frenchTerm}" → "${TRANSLATION_OVERRIDES[normalized]}"`);
            }
            return TRANSLATION_OVERRIDES[normalized];
        }

        try {
            const result = await translate(normalized, { to: 'en' });
            const translated = this.normalizeEnglishTerm(result.text);
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Recettes] Traduction: "${frenchTerm}" → "${translated}"`);
            }
            return translated;
        } catch (error) {
            console.error('Erreur traduction ingredient:', error);
            return normalized;
        }
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

    /* Ingrédients de la recette cités dans le texte d'une étape. La comparaison
       se fait sur des mots entiers, sans accent : « ail » ne doit pas se
       reconnaître dans « travail », mais « tomate » doit l'être dans « tomates ». */
    citedIngredients(text, ingredients) {
        const haystack = ` ${this.deburr(text)} `;
        const found = [];

        ingredients.forEach(({ name }) => {
            const term = this.deburr(name);
            if (term.length < 3) return;
            const pattern = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?([^a-z0-9]|$)`);
            if (pattern.test(haystack) && !found.includes(name)) found.push(name);
        });

        return found;
    }

    deburr(value) {
        return String(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/œ/g, 'oe');
    }

    // Accroche courte : on s'arrête à une fin de phrase, jamais au milieu d'un mot
    buildSummary(text, max = 220) {
        const flat = String(text).replace(/\s+/g, ' ').trim();
        if (flat.length <= max) return flat;

        const cut = flat.slice(0, max);
        const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
        if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);

        const lastSpace = cut.lastIndexOf(' ');
        return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
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
                measure: this.localizeMeasure(ing.measure)
            }))
        );

        return translatedIngredients;
    }

    // Recherche de recettes avec traduction

    async searchRecipes(query, number = 12, preTranslatedEn = null) {
        try {
            // Normaliser la requête (enlever les pluriels)
            const normalizedQuery = this.normalizeSearchTerm(query);

            // Traduire la requête normalisée en anglais pour TheMealDB (ou utiliser la valeur pré-traduite)
            const englishQuery = preTranslatedEn ?? await this.translateIngredient(normalizedQuery);

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
                        ...this.mealMeta(meal)
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
            const rawSteps = this.splitInstructions(meal.strInstructions);

            const [translatedTitle, translatedSteps, translatedIngredients] = await Promise.all([
                this.translateToFrench(meal.strMeal),
                Promise.all(rawSteps.map(step => this.translateToFrench(step))),
                this.extractAndTranslateIngredients(meal)
            ]);

            const instructions = translatedSteps.join('\n\n');

            return {
                id: meal.idMeal,
                title: translatedTitle,
                image: meal.strMealThumb,
                readyInMinutes: 30,
                servings: 4,
                instructions,
                // Chaque étape porte les ingrédients de la recette qu'elle cite
                steps: translatedSteps.map(text => ({
                    text,
                    ingredients: this.citedIngredients(text, translatedIngredients)
                })),
                extendedIngredients: translatedIngredients,
                sourceUrl: meal.strSource,
                summary: this.buildSummary(instructions),
                ...this.mealMeta(meal)
            };
        } catch (error) {
            console.error('Erreur getRecipeDetails:', error);
            throw error;
        }
    }

    // Chercher des recettes par ingrédient principal (recettes françaises en priorité)

    async findByIngredients(ingredients, number = 6, preTranslatedEn = null) {
        try {
            const mainIngredient = ingredients[0];

            // Traduire l'ingrédient en anglais pour TheMealDB (ou utiliser la valeur pré-traduite)
            const englishIngredient = preTranslatedEn ?? await this.translateIngredient(mainIngredient);

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

            // filter.php ne renvoie que l'id, le titre et la vignette : catégorie,
            // origine et liste d'ingrédients demandent une fiche complète par recette.
            const lookups = await Promise.all(
                prioritized.map(meal => this.lookupMeal(meal.idMeal))
            );

            // Termes anglais de tous les ingrédients demandés, pour savoir
            // lesquels apparaissent réellement dans chaque recette
            const asked = await this.translateAskedIngredients(
                ingredients, mainIngredient, preTranslatedEn ?? null
            );

            const recipes = await Promise.all(
                prioritized.map(async (meal, index) => {
                    const full = lookups[index];
                    const translatedTitle = await this.translateToFrench(meal.strMeal);
                    const meta = full ? this.mealMeta(full) : {};
                    const names = full ? this.rawIngredientNames(full) : [];

                    return {
                        id: meal.idMeal,
                        title: translatedTitle,
                        image: meal.strMealThumb,
                        usedIngredientCount: 1,
                        readyInMinutes: 30,
                        servings: 4,
                        ...meta,
                        matchedIngredients: asked
                            .filter(a => names.some(n => n.includes(a.en)))
                            .map(a => a.fr)
                    };
                })
            );

            return recipes;
        } catch (error) {
            console.error('Erreur findByIngredients:', error);
            throw error;
        }
    }

    // Fiche complète d'un plat ; renvoie null plutôt que d'interrompre la recherche
    async lookupMeal(mealId) {
        try {
            const response = await fetch(`${THEMEALDB_BASE_URL}/lookup.php?i=${mealId}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.meals?.[0] || null;
        } catch (error) {
            console.error('Erreur lookupMeal:', error);
            return null;
        }
    }

    // Couples { fr, en } des ingrédients recherchés, dédoublonnés
    async translateAskedIngredients(ingredients, mainIngredient, preTranslatedEn) {
        const unique = [...new Set(ingredients.filter(Boolean))];
        return Promise.all(
            unique.map(async (fr) => ({
                fr,
                en: (fr === mainIngredient && preTranslatedEn)
                    ? preTranslatedEn.toLowerCase()
                    : (await this.translateIngredient(fr)).toLowerCase()
            }))
        );
    }

    // Obtenir des suggestions de recettes pour un panier hebdomadaire

    async getSuggestionsForWeeklyBasket(weeklyBasketItems) {
        // Un item du panier peut être libre (customProductName) et n'avoir aucun produit
        const ingredients = weeklyBasketItems
            .map(item => item.product?.name || item.customProductName)
            .filter(Boolean);

        if (ingredients.length === 0) return [];

        const recipes = await this.findByIngredients(ingredients, 6);
        return recipes;
    }
}

export default new RecipeService();