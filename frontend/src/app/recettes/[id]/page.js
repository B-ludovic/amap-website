import RecipeDetailClient from './RecipeDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

  const parts = [recipe.categoryLabel, recipe.areaLabel].filter(Boolean).join(' · ');
  const description = recipe.summary
    ? recipe.summary.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Recette ${recipe.title}${parts ? ` — ${parts}` : ''}`;

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
