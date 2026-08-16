/* L'identité de l'AMAP telle que les moteurs la lisent, en un seul endroit.

   Deux données coexistent dans ce projet et se contredisent facilement : le
   siège social de l'association, dans le Loiret, et le lieu où les paniers sont
   réellement distribués, à Clamart. Le siège est une adresse administrative ;
   il n'accueille personne et ne répond à aucune recherche de panier. C'est donc
   Clamart qui porte l'adresse, les coordonnées et les horaires publiés ici. Le
   siège reste affiché là où la loi l'exige, dans les mentions légales. */

import { CONTACT_EMAIL } from './association';

export const SITE_URL = 'https://auxptitspois.fr';

const PICKUP_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: '340 Avenue du Général de Gaulle',
  addressLocality: 'Clamart',
  postalCode: '92140',
  addressRegion: 'Île-de-France',
  addressCountry: 'FR',
};

const PICKUP_GEO = {
  '@type': 'GeoCoordinates',
  latitude: 48.7998,
  longitude: 2.2677,
};

const PICKUP_HOURS = {
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: 'https://schema.org/Wednesday',
  opens: '18:15',
  closes: '19:15',
};

/* Les communes que la distribution dessert réellement : Clamart et sa couronne,
   toutes à quelques minutes du point de retrait. Sans cette liste, un moteur qui
   lit « 92140 » ne sait pas si la question « AMAP à Meudon » le concerne. */
const AREA_SERVED = [
  'Clamart',
  'Meudon',
  'Issy-les-Moulineaux',
  'Vanves',
  'Malakoff',
  'Châtillon',
  'Fontenay-aux-Roses',
  'Le Plessis-Robinson',
  'Bagneux',
  'Sceaux',
].map(name => ({ '@type': 'City', name, addressRegion: 'Île-de-France' }));

/* Le lieu de distribution, déclaré à part de l'association pour qu'il porte son
   propre nom : c'est l'église que les adhérents cherchent sur une carte. */
export const pickupPlaceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Place',
  '@id': `${SITE_URL}/#point-de-retrait`,
  name: 'Point de retrait AMAP — Paroisse Saint François de Sales',
  description: "Lieu de distribution hebdomadaire des paniers de l'AMAP Aux P'tits Pois, chaque mercredi de 18h15 à 19h15.",
  address: PICKUP_ADDRESS,
  geo: PICKUP_GEO,
  openingHoursSpecification: PICKUP_HOURS,
  hasMap: 'https://maps.google.com/?q=340+Avenue+du+Général+de+Gaulle,+92140+Clamart',
};

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['NGO', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: "Aux P'tits Pois",
  alternateName: ["AMAP Aux P'tits Pois", 'AMAP de Clamart'],
  description: "AMAP solidaire de Clamart (92140) : chaque mercredi de 18h15 à 19h15, ses adhérents retirent un panier de légumes bio et de saison remis en direct par les fermes partenaires, sans intermédiaire.",
  url: SITE_URL,
  email: CONTACT_EMAIL,
  address: PICKUP_ADDRESS,
  geo: PICKUP_GEO,
  openingHoursSpecification: PICKUP_HOURS,
  location: { '@id': pickupPlaceJsonLd['@id'] },
  areaServed: AREA_SERVED,
  knowsAbout: [
    'AMAP',
    'agriculture biologique',
    'circuit court',
    'panier de légumes',
    'vente directe',
  ],
  sameAs: [
    'https://hautsdeseine.secours-catholique.org/notre-actualite/lamap-aux-ptits-pois-de-clamart',
    'https://www.wedemain.fr/sauver-la-planete/initiatives-ecologiques-locales/initiatives-et-innovations-ecologiques-en-ile-de-france/aux-ptits-pois-une-association-solidaire-pour-manger-mieux-1135361',
  ],
  inLanguage: 'fr',
};
