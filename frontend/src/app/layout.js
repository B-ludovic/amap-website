import { headers } from 'next/headers';
import { Fraunces, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import CookieConsent from '../components/CookieConsent';
import ConditionalHeader from '../components/layout/ConditionalHeader';
import ConditionalFooter from '../components/layout/ConditionalFooter';
import Providers from '../components/Providers';
import JsonLd from '../components/JsonLd';
import { CONTACT_EMAIL } from '../constants/association';
import '../../public/orejime/orejime-standard.css';
import '../styles/components/orejime.css';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/da.css';
import '../styles/components/modal.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-fraunces',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

const fontVariables = `${fraunces.variable} ${jakarta.variable} ${geistMono.variable}`;

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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aux P\'tits Pois - AMAP locale',
    description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires.',
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
  email: CONTACT_EMAIL,
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

  /* Le middleware pose cet en-tête quand il réécrit la requête vers la porte
     d'invitation. L'URL demandée n'ayant pas bougé, usePathname ne peut pas
     distinguer ce cas : c'est l'en-tête qui le dit. La coquille se réduit alors
     à la modale — ni navigation, ni pied de page, ni bandeau de cookies à
     accepter avant d'avoir seulement vu le site. */
  if (headersList.get('x-invite-gate') === '1') {
    return (
      <html lang="fr" className={fontVariables}>
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="fr" className={fontVariables}>
      <body>
        <a href="#main-content" className="skip-link">Aller au contenu principal</a>
        <JsonLd data={organizationJsonLd} nonce={nonce} />
        <Providers>
          <ConditionalHeader />
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