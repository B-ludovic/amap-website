'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

function Header() {
  const router = useRouter();
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
            <span className="logo-icon">🌱</span>
            <span className="logo-text">Aux P'tits Pois</span>
          </Link>

          {/* Navigation desktop */}
          <nav className="header-nav">
            <Link href="/" className="nav-link">
              Accueil
            </Link>
            <Link href="/blog" className="nav-link">
              Blog
            </Link>
          </nav>

          {/* Actions */}
          <div className="header-actions">
            {user ? (
              <>
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

        {/* Menu mobile */}
        <div className={`header-mobile-menu ${isMenuOpen ? 'mobile-menu-open' : ''}`}>
          <nav className="mobile-nav">
            <Link href="/" className="mobile-nav-link" onClick={closeMenu}>
              Accueil
            </Link>
            <Link href="/blog" className="mobile-nav-link" onClick={closeMenu}>
              Blog
            </Link>

            <div className="mobile-nav-divider"></div>

            {user ? (
              <>
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
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;