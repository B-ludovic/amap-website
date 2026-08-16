import Link from 'next/link';
import Image from 'next/image';
import { CONTACT_EMAIL } from '../../constants/association';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          {/* Colonne 1 : À propos */}
          <div className="footer-column">
            <h3 className="footer-title">
              <Image
                src="/icons/logo.png"
                alt="Logo Aux P'tits Pois"
                width={34}
                height={34}
                className="footer-icon"
              />
              Aux P&apos;tits Pois
            </h3>
            <p className="footer-description">
              Votre AMAP locale à Clamart. Des produits frais, bio et de saison,
              en circuit court.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="footer-mail">
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* Colonne 2 : Navigation */}
          <div className="footer-column">
            <h4 className="footer-heading">Navigation</h4>
            <ul className="footer-links">
              <li>
                <Link href="/" className="footer-link">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/nos-abonnements" className="footer-link">
                  Nos abonnements
                </Link>
              </li>
              <li>
                <Link href="/panier-semaine" className="footer-link">
                  Panier de la semaine
                </Link>
              </li>
              <li>
                <Link href="/nos-producteurs" className="footer-link">
                  Nos producteurs
                </Link>
              </li>
              <li>
                <Link href="/devenir-producteur" className="footer-link">
                  Devenir producteur
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonne 3 : Mon Compte */}
          <div className="footer-column">
            <h4 className="footer-heading">Mon compte</h4>
            <ul className="footer-links">
              <li>
                <Link href="/auth/login" className="footer-link">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="footer-link">
                  Inscription
                </Link>
              </li>
              <li>
                <Link href="/compte" className="footer-link">
                  Espace adhérent
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonne 4 : Informations */}
          <div className="footer-column">
            <h4 className="footer-heading">Informations</h4>
            <ul className="footer-links">
              <li>
                <Link href="/contact" className="footer-link">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/faq" className="footer-link">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="footer-link">
                  Conditions d&apos;utilisation
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="footer-link">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="footer-link">
                  Gestion des cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bas du footer */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} Aux P&apos;tits Pois — Tous droits réservés
          </p>
          <p className="footer-place">Clamart · Île-de-France</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;