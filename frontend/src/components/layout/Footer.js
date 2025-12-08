import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';
 

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
                src="/icons/pea.png" 
                alt="" 
                width={24} 
                height={24}
                className="footer-icon"
              />
              Aux P&apos;tits Pois
            </h3>
            <p className="footer-description">
              Votre AMAP locale pour des produits frais, bio et de saison.
              Soutenez l&apos;agriculture locale et mangez sainement.
            </p>
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
            </ul>
          </div>

          {/* Colonne 3 : Mon Compte */}
          <div className="footer-column">
            <h4 className="footer-heading">Mon Compte</h4>
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
                  Mon Compte
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
                <Link href="/mentions-legales" className="footer-link">
                  Mentions Légales
                </Link>
              </li>
              <li>
                <Link href="/cgv" className="footer-link">
                  CGV
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bas du footer */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} Aux P&apos;tits Pois. Tous droits réservés.
          </p>
          <div className="footer-socials">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="Facebook"
            >
              <Image 
                src="/icons/facebook.png" 
                alt="Facebook" 
                width={20} 
                height={20}
              />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-link"
              aria-label="Instagram"
            >
              <Image 
                src="/icons/instagram.png" 
                alt="Instagram" 
                width={20} 
                height={20}
              />
            </a>
            <a
              href="mailto:contact@auxptitspois.fr"
              className="footer-social-link"
              aria-label="Email"
            >
              <Mail size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;