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
  }, [showError]);

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

            <Link href="/admin/commandes" className="admin-stat-card">
              <div className="admin-stat-icon orders">
                <ShoppingCart size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Commandes</p>
                <p className="admin-stat-value">{stats.stats.orders}</p>
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

            <div className="admin-stat-card">
              <div className="admin-stat-icon revenue">
                <TrendingUp size={24} />
              </div>
              <div className="admin-stat-content">
                <p className="admin-stat-label">Revenu total</p>
                <p className="admin-stat-value">{stats.stats.revenue.toFixed(2)} €</p>
              </div>
            </div>
          </div>
        )}

        <div className="admin-section">
          <h2 className="admin-section-title">Commandes récentes</h2>
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order) => (
                    <tr 
                      key={order.id}
                      onClick={() => router.push(`/admin/commandes/${order.id}`)}
                      className="admin-table-row-clickable"
                    >
                      <td>
                        <span className="admin-order-number">
                          #{order.orderNumber || order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td>{order.user?.firstName} {order.user?.lastName}</td>
                      <td className="admin-table-amount">{order.totalAmount.toFixed(2)} €</td>
                      <td>
                        <span className={`admin-status-badge admin-status-${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">
              <ShoppingCart size={48} />
              <p>Aucune commande récente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
