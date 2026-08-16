import { headers } from 'next/headers';
import JsonLd from '../../components/JsonLd';
import { fetchPublicProducers } from '../../lib/producers';

export const metadata = {
  title: "Nos fermes partenaires",
  description: "Les fermes bio partenaires de notre AMAP de Clamart (92140) : qui elles sont, où elles cultivent, ce qu'elles livrent chaque mercredi au point de retrait.",
};

export default async function Layout({ children }) {
  const producers = await fetchPublicProducers();
  const nonce = (await headers()).get('x-nonce') ?? '';

  /* Une ferme est une exploitation, pas une personne : le type Person annonçait
     M. Untel là où la fiche porte le nom d'une entreprise agricole. La commune
     est déclarée quand elle est connue — c'est elle qui permet aux moteurs de
     situer la production, maintenant qu'aucune distance n'est plus affichée. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: "Fermes partenaires de l'AMAP Aux P'tits Pois",
    description: "Les exploitations agricoles qui fournissent les paniers de l'AMAP Aux P'tits Pois, à Clamart (92140).",
    numberOfItems: producers.length,
    itemListElement: producers.map((producer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Organization',
        name: producer.name,
        description: producer.description || producer.specialty || undefined,
        ...(producer.city || producer.postalCode
          ? {
              address: {
                '@type': 'PostalAddress',
                ...(producer.city && { addressLocality: producer.city }),
                ...(producer.postalCode && { postalCode: producer.postalCode }),
                addressCountry: 'FR',
              },
            }
          : {}),
      },
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} nonce={nonce} />
      {children}
    </>
  );
}
