import { headers } from 'next/headers';
import JsonLd from '../../components/JsonLd';
import { SIZES, SUBSCRIPTIONS } from '../../constants/subscriptions';
import { organizationJsonLd, SITE_URL } from '../../constants/structuredData';

export const metadata = {
  title: 'Nos abonnements',
  description: "Les formules d'abonnement de l'AMAP de Clamart : panier hebdomadaire de légumes bio et de saison, engagement annuel ou découverte de 3 mois, avec un tarif solidaire pour les budgets contraints.",
};

/* Un abonnement AMAP n'est pas un produit qu'on ajoute à un panier : c'est une
   part de récolte réservée pour une saison. Le déclarer en Offer donne aux
   moteurs le prix, la durée et le lieu de retrait — les trois éléments qu'ils
   citent quand on leur demande combien coûte un panier ici. Les formules à
   venir sont annoncées comme telles plutôt que présentées comme disponibles. */
function offerFor(subscription) {
  const size = SIZES[subscription.size];

  return {
    '@type': 'Offer',
    name: `${subscription.name} — ${size.name} (${size.weight})`,
    description: `${subscription.duration}, distribution chaque mercredi de 18h15 à 19h15 au point de retrait de Clamart. Tarif solidaire : ${subscription.priceSolidarity.toFixed(2)} €.`,
    price: subscription.priceNormal.toFixed(2),
    priceCurrency: 'EUR',
    availability: subscription.comingSoon
      ? 'https://schema.org/PreOrder'
      : 'https://schema.org/InStock',
    url: `${SITE_URL}/nos-abonnements`,
    seller: { '@id': organizationJsonLd['@id'] },
    areaServed: organizationJsonLd.areaServed,
    eligibleQuantity: {
      '@type': 'QuantitativeValue',
      value: subscription.weeks,
      unitText: 'semaines de distribution',
    },
  };
}

const offersJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OfferCatalog',
  '@id': `${SITE_URL}/nos-abonnements#offres`,
  name: "Abonnements de l'AMAP Aux P'tits Pois à Clamart",
  description: "Paniers hebdomadaires de légumes bio et de saison, retirés chaque mercredi à Clamart (92140).",
  numberOfItems: SUBSCRIPTIONS.length,
  itemListElement: SUBSCRIPTIONS.map(offerFor),
};

export default async function Layout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <>
      <JsonLd data={offersJsonLd} nonce={nonce} />
      {children}
    </>
  );
}
