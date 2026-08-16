/* Les fermes partenaires, lues au même endroit par la page d'accueil, la page
   qui leur est consacrée et les données structurées. Trois vitrines pour un
   seul jeu de fiches : rien ne peut plus diverger d'une page à l'autre. */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/* Illustrations de repli, en attendant les clichés des fermes. Elles tournent
   dans l'ordre des fiches pour que deux voisines ne se ressemblent pas. */
const ILLUSTRATIONS = [
  '/placeholder/legumes-terre.webp',
  '/placeholder/legumes-jardin.webp',
  '/placeholder/legumes-ht.webp',
];

export async function fetchPublicProducers() {
  try {
    const res = await fetch(`${API_URL}/producers`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.producers ?? []).filter(producer => producer.isActive);
  } catch {
    return [];
  }
}

/* Une illustration générique ne montre pas cette ferme : elle n'a donc rien à
   annoncer aux lecteurs d'écran, et son alternative reste vide. */
export function producerPhoto(producer, index) {
  const isOwn = Boolean(producer?.image);
  return {
    src: isOwn ? producer.image : ILLUSTRATIONS[index % ILLUSTRATIONS.length],
    alt: isOwn ? producer.name : '',
    isOwn,
  };
}

/* Situe la ferme sans avancer de distance : la commune est vérifiable, un
   nombre de kilomètres se contredit dès qu'une ferme entre ou sort. */
export function producerPlace(producer) {
  if (producer.city) {
    return producer.postalCode ? `${producer.city} (${producer.postalCode})` : producer.city;
  }
  return producer.postalCode || '';
}
