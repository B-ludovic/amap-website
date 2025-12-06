import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { AuthProvider } from '../contexts/AuthContext';
import { CartProvider } from '../contexts/CartContext';
import { ModalProvider } from '../contexts/ModalContext';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/components/basket-card.css';
import '../styles/components/producer-card.css';
import '../styles/components/stripe-payment-form.css';
import '../styles/pages/home.css';
import '../styles/pages/panier.css';
import '../styles/pages/cart.css';
import '../styles/pages/producteurs.css';
import '../styles/pages/auth.css';
import '../styles/pages/compte.css';
import '../styles/pages/commandes.css';
import '../styles/pages/basket-detail.css';
import '../styles/pages/checkout.css';


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
            <CartProvider>
              <Header />
              <main className="main-content">
                {children}
              </main>
              <Footer />
            </CartProvider>
          </ModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

export { metadata };
export default RootLayout;