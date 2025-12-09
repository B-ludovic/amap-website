'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { LayoutDashboard, Users, ShoppingCart, Package, TrendingUp, XCircle } from 'lucide-react';
import '../../styles/admin/dashboard.css';
import { useModal } from '../../contexts/ModalContext';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useModal();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.admin.stats.get();
        setStats(response.data);
        setError(null);
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        setError(error.message);
        showError('Erreur', 'Impossible de charger les statistiques.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <p>Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <XCircle size={48} />
          <p>Impossible de charger les statistiques</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          <LayoutDashboard size={28} />
          Tableau de bord
        </h1>
        <p className="admin-page-description">
          Bienvenue {user?.firstName} ! Voici un aperçu de votre AMAP.
        </p>
      </div>

      <div className="admin-page-content">
        {stats && (
          <div className="admin-stats-grid">
            <Link href="/admin/utilisateurs" className="admin-stat-card">
              <div className="admin-stat-icon users">
                <Users size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Utilisateurs</p>
                <p className="admin-stat-value">{stats.stats.users}</p>
              </div>
            </Link>

            <Link href="/admin/abonnements" className="admin-stat-card">
              <div className="admin-stat-icon orders">
                <ShoppingCart size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Abonnements</p>
                <p className="admin-stat-value">{stats.stats.subscriptions}</p>
                <p className="admin-stat-subtitle">{stats.stats.activeSubscriptions} actifs</p>
              </div>
            </Link>

            <Link href="/admin/producteurs" className="admin-stat-card">
              <div className="admin-stat-icon producers">
                <Package size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Producteurs</p>
                <p className="admin-stat-value">{stats.stats.producers}</p>
              </div>
            </Link>

            <Link href="/admin/demandes-abonnements" className="admin-stat-card">
              <div className="admin-stat-icon revenue">
                <TrendingUp size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Demandes en attente</p>
                <p className="admin-stat-value">{stats.stats.pendingRequests}</p>
                <p className="admin-stat-subtitle">{stats.stats.pendingRequests} abonnements · {stats.stats.producerInquiries} producteurs</p>
              </div>
            </Link>
          </div>
        )}

        <div className="admin-section">
          <h2 className="admin-section-title">Activités récentes</h2>
          {stats?.recentActivities && stats.recentActivities.length > 0 ? (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Taille</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivities.map((activity) => (
                    <tr 
                      key={activity.id}
                      onClick={() => router.push(`/admin/abonnements`)}
                      className="admin-table-row-clickable"
                    >
                      <td>{activity.user?.firstName} {activity.user?.lastName}</td>
                      <td>{activity.type === 'ANNUAL' ? 'Annuel' : 'Découverte'}</td>
                      <td>{activity.basketSize === 'SMALL' ? 'Petit' : 'Grand'}</td>
                      <td>
                        <span className={`admin-status-badge admin-status-${activity.status.toLowerCase()}`}>
                          {activity.status}
                        </span>
                      </td>
                      <td>{new Date(activity.createdAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">
              <ShoppingCart size={48} />
              <p>Aucune activité récente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
