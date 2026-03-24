import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Providers from '../components/Providers';
import CookieConsent from '../components/CookieConsent';
import JsonLd from '../components/JsonLd';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/modal.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/components/tarteaucitron.css';
import '../styles/public/auth.css';
import '../styles/public/compte.css';
import '../styles/public/home.css';
import '../styles/public/subscriptions.css';
import '../styles/public/subscription-request.css';
import '../styles/public/weekly-basket.css';
import '../styles/public/become-producer.css';
import '../styles/public/producers.css';
import '../styles/public/recipe.css';
import '../styles/public/recipes.css';
import '../styles/public/recipes-detail.css';
import '../styles/public/legal.css';
import '../styles/public/faq.css';
import '../styles/public/contact.css';
import '../styles/admin/dashboard.css';
import '../styles/admin/layout.css';
import '../styles/admin/components.css';
import '../styles/admin/parametres.css';
import '../styles/admin/messages.css';
import '../styles/admin/communication.css';
import '../styles/admin/permanences.css';
import '../styles/admin/request.css';
import '../styles/admin/requests.css';
import '../styles/admin/subscription.css';
import '../styles/admin/fermetures.css';
import '../styles/admin/journal.css';
import '../styles/admin/weekly-basket.css';
import '../styles/admin/distribution.css';
import '../styles/admin/tiptap.css';


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
  '@type': 'LocalBusiness',
  name: "Aux P'tits Pois",
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
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: 'Wednesday',
    opens: '18:15',
    closes: '19:15',
  },
  areaServed: {
    '@type': 'GeoCircle',
    geoMidpoint: { '@type': 'GeoCoordinates' },
    geoRadius: '30000',
  },
  inLanguage: 'fr',
};

function RootLayout({ children }) {
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
          <Footer />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}

export default RootLayout;