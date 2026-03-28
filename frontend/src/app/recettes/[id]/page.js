import RecipeDetailClient from './RecipeDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchRecipeMeta(id) {
  try {
    const res = await fetch(`${API_URL}/recipes/${id}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const recipe = await fetchRecipeMeta(params.id);

  if (!recipe) {
    return {
      title: 'Recette | Aux P\'tits Pois',
    };
  }

  const description = recipe.summary
    ? recipe.summary.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Recette ${recipe.title} — ${recipe.readyInMinutes ? `${recipe.readyInMinutes} min · ` : ''}${recipe.servings ? `${recipe.servings} personnes` : ''}`.trim();

  return {
    title: `${recipe.title} | Aux P'tits Pois`,
    description,
    openGraph: {
      title: recipe.title,
      description,
      images: recipe.image ? [{ url: recipe.image }] : [],
    },
  };
}

export default function RecipeDetailPage() {
  return <RecipeDetailClient />;
}
