import { headers } from 'next/headers';
import CookieConsent from '../components/CookieConsent';
import Header from '../components/layout/Header';
import ConditionalFooter from '../components/layout/ConditionalFooter';
import Providers from '../components/Providers';
import JsonLd from '../components/JsonLd';
import '../../public/orejime/orejime-standard.css';
import '../styles/components/orejime.css';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/modal.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/public/compte.css';


export const metadata = {
  title: {
    default: 'Aux P\'tits Pois - AMAP locale',
    template: '%s | Aux P\'tits Pois',
  },
  description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires. AMAP solidaire avec tarif accessible à tous.',
  keywords: ['AMAP', 'panier bio', 'légumes locaux', 'circuit court', 'agriculture biologique', 'producteurs locaux'],
  openGraph: {
    title: 'Aux P\'tits Pois - AMAP locale',
    description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Aux P\'tits Pois',
    images: [{ url: 'https://auxptitspois.fr/images/og-image.png', width: 1200, height: 630, alt: 'Aux P\'tits Pois - AMAP locale' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aux P\'tits Pois - AMAP locale',
    description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires.',
    images: ['https://auxptitspois.fr/images/og-image.png'],
  },
  metadataBase: new URL('https://auxptitspois.fr'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'z6no3ktuJhB7CymkNr7GSXEXmiOh3E9i4FtbD-h4nQY',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  name: "Aux P'tits Pois",
  alternateName: "AMAP Aux P'tits Pois",
  description: 'AMAP solidaire proposant des paniers de légumes bio et locaux auprès de producteurs partenaires.',
  url: 'https://auxptitspois.fr',
  '@id': 'https://auxptitspois.fr/#organization',
  email: 'auxptitspois@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '340 Avenue du Général de Gaulle',
    addressLocality: 'Clamart',
    postalCode: '92140',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 48.7998,
    longitude: 2.2677,
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: 'Wednesday',
    opens: '18:15',
    closes: '19:15',
  },
  sameAs: [
    'https://hautsdeseine.secours-catholique.org/notre-actualite/lamap-aux-ptits-pois-de-clamart',
    'https://www.wedemain.fr/sauver-la-planete/initiatives-ecologiques-locales/initiatives-et-innovations-ecologiques-en-ile-de-france/aux-ptits-pois-une-association-solidaire-pour-manger-mieux-1135361',
  ],
  inLanguage: 'fr',
};

async function RootLayout({ children }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <html lang="fr">
      <body>
        <a href="#main-content" className="skip-link">Aller au contenu principal</a>
        <JsonLd data={organizationJsonLd} />
        <Providers>
          <Header />
          <main className="main-content" id="main-content">
            {children}
          </main>
          <ConditionalFooter />
          <CookieConsent nonce={nonce} />
        </Providers>
      </body>
    </html>
  );
}

export default RootLayout;