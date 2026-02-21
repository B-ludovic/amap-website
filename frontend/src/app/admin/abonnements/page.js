'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import SubscriptionDetailModal from "../../../components/admin/SubscriptionDetailModal";
import ContractModal from "../../../components/admin/ContractModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/subscription.css";
import {
    CreditCard,
    Eye,
    Edit2,
    XCircle,
    PauseCircle,
    PlayCircle,
    Filter,
    Search
} from "lucide-react";

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    pricingType: ''
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedSubscriptionForContract, setSelectedSubscriptionForContract] = useState(null);
  
  const { showSuccess, showError } = useModal();

  useEffect(() => {
    fetchSubscriptions();
    fetchStats();
  }, [filters]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        limit: 50
      };
      
      const response = await api.subscriptions.getAll(params);
      setSubscriptions(response.data.subscriptions);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement des abonnements');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.subscriptions.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const handleViewDetail = async (subscriptionId) => {
    try {
      const response = await api.subscriptions.getById(subscriptionId);
      setSelectedSubscription(response.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement des détails');
    }
  };

  const handlePause = async (subscriptionId) => {
    const startDate = prompt('Date de début de pause (YYYY-MM-DD) :');
    const endDate = prompt('Date de fin de pause (YYYY-MM-DD) :');
    const reason = prompt('Raison (optionnel) :');

    if (!startDate || !endDate) return;

    try {
      await api.subscriptions.pause(subscriptionId, {
        startDate,
        endDate,
        reason
      });
      showSuccess('Succès', 'Abonnement mis en pause');
      fetchSubscriptions();
      fetchStats();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la mise en pause');
    }
  };

  const handleResume = async (subscriptionId) => {
    if (!confirm('Reprendre cet abonnement ?')) return;

    try {
      await api.subscriptions.resume(subscriptionId);
      showSuccess('Succès', 'Abonnement réactivé');
      fetchSubscriptions();
      fetchStats();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la réactivation');
    }
  };

  const handleCancel = async (subscriptionId) => {
    const reason = prompt('Raison de l\'annulation :');
    if (!reason) return;

    if (!confirm('Êtes-vous sûr de vouloir annuler cet abonnement ?')) return;

    try {
      await api.subscriptions.cancel(subscriptionId, { reason });
      showSuccess('Succès', 'Abonnement annulé');
      fetchSubscriptions();
      fetchStats();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de l\'annulation');
    }
  };

  const handleViewContract = (sub) => {
    setSelectedSubscriptionForContract(sub);
    setIsContractModalOpen(true);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      sub.user.firstName.toLowerCase().includes(search) ||
      sub.user.lastName.toLowerCase().includes(search) ||
      sub.user.email.toLowerCase().includes(search) ||
      sub.subscriptionNumber.toLowerCase().includes(search)
    );
  });

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status) => {
    const statuses = {
      PENDING: { label: 'En attente', color: 'warning' },
      ACTIVE: { label: 'Actif', color: 'success' },
      PAUSED: { label: 'En pause', color: 'secondary' },
      EXPIRED: { label: 'Expiré', color: 'error' },
      CANCELLED: { label: 'Annulé', color: 'error' }
    };
    
    const info = statuses[status] || statuses.PENDING;
    return <span className={`badge badge-${info.color}`}>{info.label}</span>;
  };

  const getTypeBadge = (type) => {
    return type === 'ANNUAL' ? (
      <span className="badge badge-primary">Annuel</span>
    ) : (
      <span className="badge badge-info">Découverte</span>
    );
  };

  const getBasketSizeBadge = (size) => {
    return size === 'SMALL' ? (
      <span className="basket-badge basket-small">Petit</span>
    ) : (
      <span className="basket-badge basket-large">Grand</span>
    );
  };

  if (loading && !stats) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Abonnements</h1>
          <p className="page-subtitle">Gérez tous les abonnements</p>
        </div>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-success">
              <CreditCard size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Abonnements actifs</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-warning">
              <PauseCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.paused}</div>
              <div className="stat-label">En pause</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-danger">
              <XCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.cancelled}</div>
              <div className="stat-label">Annulés</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-primary">
              <CreditCard size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.solidarity}</div>
              <div className="stat-label">Tarif solidaire</div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres et recherche */}
      <div className="toolbar">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Rechercher un adhérent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="toolbar-filters">
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="PAUSED">En pause</option>
            <option value="PENDING">En attente</option>
            <option value="EXPIRED">Expirés</option>
            <option value="CANCELLED">Annulés</option>
          </select>

          <select
            className="filter-select"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="ANNUAL">Annuel</option>
            <option value="DISCOVERY">Découverte</option>
          </select>

          <select
            className="filter-select"
            value={filters.pricingType}
            onChange={(e) => handleFilterChange('pricingType', e.target.value)}
          >
            <option value="">Toutes les tarifications</option>
            <option value="NORMAL">Normal</option>
            <option value="SOLIDARITY">Solidaire</option>
          </select>
        </div>
      </div>

      {/* Liste des abonnements */}
      {loading ? (
        <div className="loading-state">Chargement...</div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} />
          <h3>Aucun abonnement trouvé</h3>
          <p>Aucun abonnement ne correspond à vos critères</p>
        </div>
      ) : (
        <div className="subscriptions-table-container">
          <table className="subscriptions-table">
            <thead>
              <tr>
                <th>N° Abonnement</th>
                <th>Adhérent</th>
                <th>Type</th>
                <th>Panier</th>
                <th>Période</th>
                <th>Statut</th>
                <th>Retraits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <button
                      className="subscription-number subscription-number-link"
                      onClick={() => handleViewContract(sub)}
                      title="Voir le contrat"
                    >
                      {sub.subscriptionNumber}
                    </button>
                  </td>

                  <td>
                    <div className="subscriber-info">
                      <div className="subscriber-name">
                        {sub.user.firstName} {sub.user.lastName}
                      </div>
                      <div className="subscriber-email">
                        {sub.user.email}
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="subscription-badges">
                      {getTypeBadge(sub.type)}
                      {sub.pricingType === 'SOLIDARITY' && (
                        <span className="badge badge-warning">Solidaire</span>
                      )}
                    </div>
                  </td>

                  <td>
                    {getBasketSizeBadge(sub.basketSize)}
                  </td>

                  <td>
                    <div className="subscription-dates">
                      <div className="date-item">
                        <span className="date-label">Début:</span>
                        <span className="date-value">{formatDate(sub.startDate)}</span>
                      </div>
                      <div className="date-item">
                        <span className="date-label">Fin:</span>
                        <span className="date-value">{formatDate(sub.endDate)}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    {getStatusBadge(sub.status)}
                  </td>

                  <td>
                    <div className="pickups-count">
                      {sub._count?.pickups || 0}
                    </div>
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-icon"
                        onClick={() => handleViewDetail(sub.id)}
                        title="Voir détails"
                      >
                        <Eye size={18} />
                      </button>

                      {sub.status === 'ACTIVE' && (
                        <button
                          className="btn btn-icon"
                          onClick={() => handlePause(sub.id)}
                          title="Mettre en pause"
                        >
                          <PauseCircle size={18} />
                        </button>
                      )}

                      {sub.status === 'PAUSED' && (
                        <button
                          className="btn btn-icon btn-success"
                          onClick={() => handleResume(sub.id)}
                          title="Reprendre"
                        >
                          <PlayCircle size={18} />
                        </button>
                      )}

                      {(sub.status === 'ACTIVE' || sub.status === 'PAUSED') && (
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => handleCancel(sub.id)}
                          title="Annuler"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isContractModalOpen && selectedSubscriptionForContract && (
        <ContractModal
          subscription={selectedSubscriptionForContract}
          onClose={() => {
            setIsContractModalOpen(false);
            setSelectedSubscriptionForContract(null);
          }}
        />
      )}

      {isDetailModalOpen && selectedSubscription && (
        <SubscriptionDetailModal
          subscription={selectedSubscription}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedSubscription(null);
          }}
          onUpdate={fetchSubscriptions}
        />
      )}
    </div>
  );
}