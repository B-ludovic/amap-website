'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, MapPin, ShoppingBasket, User, Mail, Phone, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

function ComptePage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { showConfirm } = useModal();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

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

  if (loading) {
    return (
      <div className="compte-page">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Le useEffect va rediriger
  }

  return (
    <div className="compte-page">
      <div className="container">
        <div className="compte-header">
          <h1 className="page-title">Mon Compte</h1>
          <button onClick={handleLogout} className="btn btn-outline">
            Se déconnecter
          </button>
        </div>

        <div className="compte-grid">
          {/* Informations personnelles */}
          <div className="compte-card">
            <div className="compte-card-header">
              <h2 className="compte-card-title">Informations personnelles</h2>
            </div>
            <div className="compte-card-body">
              <div className="compte-info-group">
                <span className="compte-info-label">
                  <User size={20} className="compte-info-icon" />
                  Nom complet
                </span>
                <span className="compte-info-value">
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <div className="compte-info-group">
                <span className="compte-info-label">
                  <Mail size={20} className="compte-info-icon" />
                  Email
                </span>
                <span className="compte-info-value">{user.email}</span>
              </div>
              {user.phone && (
                <div className="compte-info-group">
                  <span className="compte-info-label">
                    <Phone size={20} className="compte-info-icon" />
                    Téléphone
                  </span>
                  <span className="compte-info-value">{user.phone}</span>
                </div>
              )}
              <div className="compte-info-group">
                <span className="compte-info-label">
                  <Shield size={20} className="compte-info-icon" />
                  Rôle
                </span>
                <span className="badge badge-primary">{user.role}</span>
              </div>
            </div>
            <div className="compte-card-footer">
              <Link href="/compte/edit" className="btn btn-secondary">
                Modifier mes informations
              </Link>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="compte-card">
            <div className="compte-card-header">
              <h2 className="compte-card-title">Actions rapides</h2>
            </div>
            <div className="compte-card-body">
              <div className="compte-actions">
                <Link href="/compte/commandes" className="compte-action-link">
                  <Package size={32} className="compte-action-icon" />
                  <div className="compte-action-content">
                    <span className="compte-action-title">Mes commandes</span>
                    <span className="compte-action-description">
                      Voir l&apos;historique de vos commandes
                    </span>
                  </div>
                </Link>

                <Link href="/compte/adresses" className="compte-action-link">
                  <MapPin size={32} className="compte-action-icon" />
                  <div className="compte-action-content">
                    <span className="compte-action-title">Mes adresses</span>
                    <span className="compte-action-description">
                      Gérer vos adresses de livraison
                    </span>
                  </div>
                </Link>

                <Link href="/paniers" className="compte-action-link">
                  <ShoppingBasket size={32} className="compte-action-icon" />
                  <div className="compte-action-content">
                    <span className="compte-action-title">Commander un panier</span>
                    <span className="compte-action-description">
                      Parcourir nos paniers disponibles
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComptePage;