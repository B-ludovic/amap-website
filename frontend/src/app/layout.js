import Header from '../components/layout/header';
import Footer from '../components/layout/Footer';
import '../styles/variables.css';
import '../styles/globals.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/components/basket-card.css';
import '../styles/pages/home.css';
import '../styles/pages/panier.css';

const metadata = {
  title: 'Aux P\'tits Pois - AMAP locale',
  description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires',
};

function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        <main className="main-content">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

export { metadata };
export default RootLayout;