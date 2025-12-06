'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const { getItemCount } = useCart();

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

  const itemCount = getItemCount();

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
            <Link href="/paniers" className="nav-link">
              Nos Paniers
            </Link>
            <Link href="/producteurs" className="nav-link">
              Producteurs
            </Link>
            <Link href="/blog" className="nav-link">
              Blog
            </Link>
          </nav>

          {/* Actions */}
          <div className="header-actions">
            {/* Panier */}
            <Link href="/panier" className="header-cart-link">
              <ShoppingCart size={24} />
              {itemCount > 0 && (
                <span className="header-cart-badge">{itemCount}</span>
              )}
            </Link>

            {user ? (
              <>
                <Link href="/compte" className="nav-link">
                  Bonjour {user.firstName}
                </Link>
                <Link href="/compte/commandes" className="btn btn-primary btn-sm">
                  Mes Commandes
                </Link>
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
            <Link href="/paniers" className="mobile-nav-link" onClick={closeMenu}>
              Nos Paniers
            </Link>
            <Link href="/producteurs" className="mobile-nav-link" onClick={closeMenu}>
              Producteurs
            </Link>
            <Link href="/blog" className="mobile-nav-link" onClick={closeMenu}>
              Blog
            </Link>

            <div className="mobile-nav-divider"></div>

            <Link href="/panier" className="mobile-nav-link" onClick={closeMenu}>
              Panier {itemCount > 0 && `(${itemCount})`}
            </Link>

            {user ? (
              <>
                <Link href="/compte" className="mobile-nav-link" onClick={closeMenu}>
                  Mon Compte
                </Link>
                <Link href="/compte/commandes" className="mobile-nav-link" onClick={closeMenu}>
                  Mes Commandes
                </Link>
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