'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LogOut, 
  LayoutDashboard,
  Tractor,
  Package,
  ShoppingBasket,
  Calendar,
  Users,
  Settings,
  Mail,
  UserPlus,
  CreditCard,
  Sprout,
  UserCog
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { showConfirm } = useModal();

  // Détecter le scroll pour changer le style du header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Bloquer le scroll et gérer la touche Échap quand le menu mobile est ouvert
  useEffect(() => {
    if (isMenuOpen) {
      // Bloquer le scroll du body
      document.body.style.overflow = 'hidden';

      // Fermer avec la touche Échap
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closeMenu();
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    showConfirm(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      () => {
        logout();
        router.push('/');
      }
    );
  };

  return (
    <header className={`header ${isScrolled ? 'header-scrolled' : ''}`}>
      <div className="container">
        <div className="header-content">
          {/* Logo */}
          <Link href="/" className="header-logo" onClick={closeMenu}>
            <Image src="/icons/logo.png" alt="Logo Aux P'tits Pois" width={42} height={42} className="logo-icon" />
            <span className="logo-text">Aux P'tits Pois</span>
          </Link>

          {/* Navigation desktop */}
          <nav className="header-nav">
            <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Accueil
            </Link>
            <Link href="/nos-abonnements" className={`nav-link ${pathname === '/nos-abonnements' ? 'active' : ''}`}>
              Nos Abonnements
            </Link>
            <Link href="/panier-semaine" className={`nav-link ${pathname === '/panier-semaine' ? 'active' : ''}`}>
              Panier de la semaine
            </Link>
            <Link href="/nos-producteurs" className={`nav-link ${pathname === '/nos-producteurs' ? 'active' : ''}`}>
              Nos Producteurs
            </Link>
            <Link href="/devenir-producteur" className={`nav-link ${pathname === '/devenir-producteur' ? 'active' : ''}`}>
              Devenir Producteur
            </Link>
          </nav>

          {/* Actions */}
          <div className="header-actions">
            {user ? (
              <>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" className="nav-link">
                    Admin
                  </Link>
                )}
                <Link href="/compte" className="nav-link">
                  Bonjour {user.firstName}
                </Link>
                <button onClick={handleLogout} className="btn btn-outline btn-sm" aria-label="Se déconnecter">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="nav-link">
                  Connexion
                </Link>
                <Link href="/auth/register" className="btn btn-primary btn-sm">
                  Inscription
                </Link>
              </>
            )}
          </div>

          {/* Bouton menu mobile */}
          <button
            className="header-menu-toggle"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span className={`menu-icon ${isMenuOpen ? 'menu-icon-open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>

        {/* Backdrop mobile */}
        <div 
          className={`mobile-backdrop ${isMenuOpen ? 'backdrop-open' : ''}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* Menu mobile */}
        <div className={`header-mobile-menu ${isMenuOpen ? 'mobile-menu-open' : ''}`}>
          <div className="mobile-menu-header">
            <Link href="/" className="mobile-logo" onClick={closeMenu}>
              <Image src="/icons/logo.png" alt="Logo Aux P'tits Pois" width={32} height={32} className="logo-icon" />
              <span className="logo-text">Aux P'tits Pois</span>
            </Link>
          </div>
          <nav className="mobile-nav">
            <Link href="/" className="mobile-nav-link" onClick={closeMenu}>
              Accueil
            </Link>
            <Link href="/nos-abonnements" className="mobile-nav-link" onClick={closeMenu}>
              Nos Abonnements
            </Link>
            <Link href="/panier-semaine" className="mobile-nav-link" onClick={closeMenu}>
              Panier de la semaine
            </Link>
            <Link href="/nos-producteurs" className="mobile-nav-link" onClick={closeMenu}>
              Nos Producteurs
            </Link>
            <Link href="/devenir-producteur" className="mobile-nav-link" onClick={closeMenu}>
              Devenir Producteur
            </Link>
          </nav>

          <div className="mobile-nav-footer">
            <div className="mobile-nav-divider"></div>

            {user ? (
              <>
                {user.role === 'ADMIN' && (
                  <div className="mobile-admin-section">
                    <div className="mobile-admin-title">Administration</div>
                    <Link href="/admin" className="mobile-nav-link" onClick={closeMenu}>
                      <LayoutDashboard size={18} />
                      Dashboard
                    </Link>
                    <Link href="/admin/utilisateurs" className="mobile-nav-link" onClick={closeMenu}>
                      <Users size={18} />
                      Utilisateurs
                    </Link>
                    <Link href="/admin/demandes-abonnements" className="mobile-nav-link" onClick={closeMenu}>
                      <UserPlus size={18} />
                      Demandes abonnements
                    </Link>
                    <Link href="/admin/abonnements" className="mobile-nav-link" onClick={closeMenu}>
                      <CreditCard size={18} />
                      Abonnements
                    </Link>
                    <Link href="/admin/demandes-producteurs" className="mobile-nav-link" onClick={closeMenu}>
                      <Sprout size={18} />
                      Demandes producteurs
                    </Link>
                    <Link href="/admin/producteurs" className="mobile-nav-link" onClick={closeMenu}>
                      <Tractor size={18} />
                      Producteurs
                    </Link>
                    <Link href="/admin/produits" className="mobile-nav-link" onClick={closeMenu}>
                      <Package size={18} />
                      Produits
                    </Link>
                    <Link href="/admin/panier-hebdomadaire" className="mobile-nav-link" onClick={closeMenu}>
                      <ShoppingBasket size={18} />
                      Panier hebdomadaire
                    </Link>
                    <Link href="/admin/distribution" className="mobile-nav-link" onClick={closeMenu}>
                      <Calendar size={18} />
                      Distribution
                    </Link>
                    <Link href="/admin/permanences" className="mobile-nav-link" onClick={closeMenu}>
                      <UserCog size={18} />
                      Permanences
                    </Link>
                    <Link href="/admin/communication" className="mobile-nav-link" onClick={closeMenu}>
                      <Mail size={18} />
                      Communication
                    </Link>
                    <Link href="/admin/parametres" className="mobile-nav-link" onClick={closeMenu}>
                      <Settings size={18} />
                      Paramètres
                    </Link>
                    <div className="mobile-nav-divider"></div>
                  </div>
                )}
                <Link href="/compte" className="mobile-nav-link" onClick={closeMenu}>
                  Mon Compte
                </Link>
                <button onClick={() => { closeMenu(); handleLogout(); }} className="btn btn-outline">
                  <LogOut size={18} />
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="mobile-nav-link" onClick={closeMenu}>
                  Connexion
                </Link>
                <Link href="/auth/register" className="btn btn-primary" onClick={closeMenu}>
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;