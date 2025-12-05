import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import '../src/styles/variables.css';
import '../src/styles/globals.css';
import '../src/styles/components/header.css';
import '../src/styles/components/footer.css';

export const metadata = {
  title: 'Aux P\'tits Pois - AMAP locale',
  description: 'Commandez vos paniers de produits locaux et bio auprès de nos producteurs partenaires',
};

export default function RootLayout({ children }) {
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