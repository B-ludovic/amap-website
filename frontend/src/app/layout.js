import { headers } from 'next/headers';
import { Fraunces, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import CookieConsent from '../components/CookieConsent';
import ConditionalHeader from '../components/layout/ConditionalHeader';
import ConditionalFooter from '../components/layout/ConditionalFooter';
import Providers from '../components/Providers';
import JsonLd from '../components/JsonLd';
import { organizationJsonLd, pickupPlaceJsonLd } from '../constants/structuredData';
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
    default: 'Aux P\'tits Pois - AMAP à Clamart (92140)',
    template: '%s | Aux P\'tits Pois, AMAP à Clamart',
  },
  description: "AMAP à Clamart, Hauts-de-Seine : un panier de légumes bio et de saison chaque mercredi de 18h15 à 19h15, remis en direct par les fermes partenaires. Tarif solidaire accessible à tous.",
  keywords: ['AMAP Clamart', 'AMAP Hauts-de-Seine', 'panier bio Clamart', 'légumes bio 92140', 'circuit court Île-de-France', 'agriculture biologique', 'producteurs locaux'],
  openGraph: {
    title: 'Aux P\'tits Pois - AMAP à Clamart (92140)',
    description: 'Un panier de légumes bio et de saison chaque mercredi à Clamart, remis en direct par les fermes partenaires.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Aux P\'tits Pois',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aux P\'tits Pois - AMAP à Clamart (92140)',
    description: 'Un panier de légumes bio et de saison chaque mercredi à Clamart, remis en direct par les fermes partenaires.',
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
        <JsonLd data={pickupPlaceJsonLd} nonce={nonce} />
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