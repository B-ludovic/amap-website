import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { CartProvider } from '../contexts/CartContext';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/components/basket-card.css';
import '../styles/components/producer-card.css';
import '../styles/pages/home.css';
import '../styles/pages/panier.css';
import '../styles/pages/cart.css';
import '../styles/pages/producteurs.css';
import '../styles/pages/auth.css';
import '../styles/pages/compte.css';
import '../styles/pages/commandes.css';
import '../styles/pages/basket-detail.css';

const metadata = {
  title: 'Aux P\'tits Pois - AMAP locale',
  description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires',
};

function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>
        <Header />
        <main className="main-content">
          {children}
        </main>
        <Footer />
        </CartProvider>
      </body>
    </html>
  );
}

export { metadata };
export default RootLayout;