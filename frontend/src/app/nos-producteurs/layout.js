import JsonLd from '../../components/JsonLd';

export const metadata = {
  title: "Nos producteurs - Aux P'tits Pois",
  description: "Découvrez les agriculteurs locaux et bio partenaires de notre AMAP. Tous situés à moins de 30 km, ils cultivent vos légumes avec soin.",
};

async function fetchProducers() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const res = await fetch(`${API_URL}/producers`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.producers ?? []).filter(p => p.isActive);
  } catch {
    return [];
  }
}

export default async function Layout({ children }) {
  const producers = await fetchProducers();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: "Producteurs partenaires - Aux P'tits Pois",
    description: "Liste des producteurs locaux et bio partenaires de l'AMAP Aux P'tits Pois",
    numberOfItems: producers.length,
    itemListElement: producers.map((producer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Person',
        name: producer.name,
        description: producer.description || producer.specialty || undefined,
        ...(producer.email && { email: producer.email }),
        ...(producer.phone && { telephone: producer.phone }),
        ...(producer.website && { url: producer.website }),
      },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      {children}
    </>
  );
}
