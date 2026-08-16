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
      title: 'Recette',
      robots: { index: false, follow: true },
    };
  }

  const parts = [recipe.categoryLabel, recipe.areaLabel].filter(Boolean).join(' · ');
  const description = recipe.summary
    ? recipe.summary.replace(/<[^>]+>/g, '').slice(0, 160)
    : `Recette ${recipe.title}${parts ? ` — ${parts}` : ''}`;

  return {
    title: recipe.title,
    description,
    /* Les fiches viennent de TheMealDB, traduites : les indexer reviendrait à
       publier sous notre domaine des milliers de pages dont le contenu existe
       déjà ailleurs, et à diluer sur elles l'autorité qui doit aller à l'AMAP
       de Clamart. Les moteurs suivent les liens sans retenir la page. */
    robots: { index: false, follow: true },
    /* Une liste d'images vide n'est pas une absence de consigne : elle écrase la
       vignette du site et la recette part sans aperçu. La clé se tait plutôt. */
    openGraph: {
      title: recipe.title,
      description,
      ...(recipe.image ? { images: [{ url: recipe.image }] } : {}),
    },
  };
}

export default function RecipeDetailPage() {
  return <RecipeDetailClient />;
}
