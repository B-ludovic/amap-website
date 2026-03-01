import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Providers from '../components/Providers';
import CookieConsent from '../components/CookieConsent';
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
import '../styles/admin/dashboard.css';
import '../styles/admin/layout.css';
import '../styles/admin/components.css';
import '../styles/admin/parametres.css';


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
  robots: {
    index: true,
    follow: true,
  },
};

function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <Header />
          <main className="main-content">
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