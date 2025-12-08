import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { AuthProvider } from '../contexts/AuthContext';
import { ModalProvider } from '../contexts/ModalContext';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/modal.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/pages/auth.css';
import '../styles/pages/compte.css';
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


const metadata = {
  title: 'Aux P\'tits Pois - AMAP locale',
  description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires',
};

function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <ModalProvider>
            <Header />
            <main className="main-content">
              {children}
            </main>
            <Footer />
          </ModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

export { metadata };
export default RootLayout;