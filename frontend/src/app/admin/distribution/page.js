'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/distribution.css";
import {
    CheckCircle,
    Circle,
    Users,
    Calendar,
    Download,
    Search,
    User
} from "lucide-react";

export default function AdminDistributionPage() {
  const [currentBasket, setCurrentBasket] = useState(null);
  const [distributionList, setDistributionList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { showSuccess, showError, showWarning } = useModal();

  useEffect(() => {
    fetchCurrentBasket();
  }, []);

  useEffect(() => {
    if (currentBasket) {
      fetchDistributionList();
    }
  }, [currentBasket, searchTerm]);

  const fetchCurrentBasket = async () => {
    try {
      const response = await api.weeklyBaskets.getCurrent();
      if (response.data) {
        setCurrentBasket(response.data);
      } else {
        setCurrentBasket(null);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setCurrentBasket(null);
    }
  };

  const fetchDistributionList = async () => {
    try {
      setLoading(true);
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.distribution.getList(currentBasket.id, params);
      
      setDistributionList(response.data.list);
      setStats({
        totalSubscribers: response.data.totalSubscribers,
        pickedUp: response.data.pickedUp,
        pending: response.data.pending
      });
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement de la liste');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePickup = async (item) => {
    const newStatus = !item.pickup?.wasPickedUp;

    try {
      if (item.pickup) {
        // Mettre à jour un pickup existant
        await api.distribution.markAsPickedUp(item.pickup.id, {
          wasPickedUp: newStatus
        });
      } else {
        // Créer un nouveau pickup
        await api.distribution.markAsPickedUp('new', {
          subscriptionId: item.subscriptionId,
          weeklyBasketId: currentBasket.id,
          wasPickedUp: newStatus
        });
      }

      showSuccess(
        'Succès',
        newStatus ? 'Retrait validé' : 'Retrait annulé'
      );
      
      fetchDistributionList();
    } catch (error) {
      showError(
        'Erreur',
        error.response?.data?.message || 'Erreur lors de la mise à jour'
      );
    }
  };

  const handleAddNote = async (item) => {
    const note = prompt('Ajouter une note (ex: "Récupéré par son voisin") :');
    
    if (!note) return;

    try {
      if (item.pickup) {
        await api.distribution.markAsPickedUp(item.pickup.id, {
          wasPickedUp: item.pickup.wasPickedUp,
          notes: note
        });
      } else {
        await api.distribution.markAsPickedUp('new', {
          subscriptionId: item.subscriptionId,
          weeklyBasketId: currentBasket.id,
          wasPickedUp: false,
          notes: note
        });
      }

      showSuccess('Succès', 'Note ajoutée avec succès');
      fetchDistributionList();
    } catch (error) {
      showError('Erreur', 'Erreur lors de l\'ajout de la note');
    }
  };

  const handleExport = async () => {
    try {
      // TODO: Implémenter l'export CSV
      showWarning('Info', 'Export en cours de développement');
    } catch (error) {
      showError('Erreur', 'Erreur lors de l\'export');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getBasketSizeLabel = (size) => {
    return size === 'SMALL' ? 'Petit panier' : 'Grand panier';
  };

  if (!currentBasket) {
    return (
      <div className="admin-page">
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Aucune distribution en cours</h3>
          <p>Publiez un panier hebdomadaire pour commencer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Distribution - Émargement</h1>
          <p className="page-subtitle">
            {formatDate(currentBasket.distributionDate)} • Semaine {currentBasket.weekNumber}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          <Download size={20} />
          Exporter la liste
        </button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon primary">
              <Users size={24} color="var(--primary-color)" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalSubscribers}</div>
              <div className="stat-label">Abonnés attendus</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <CheckCircle size={24} color="#16a34a" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.pickedUp}</div>
              <div className="stat-label">Paniers récupérés</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon warning">
              <Circle size={24} color="#ca8a04" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">En attente</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon info">
              <CheckCircle size={24} color="#4f46e5" />
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {stats.totalSubscribers > 0 
                  ? Math.round((stats.pickedUp / stats.totalSubscribers) * 100) 
                  : 0}%
              </div>
              <div className="stat-label">Taux de retrait</div>
            </div>
          </div>
        </div>
      )}

      {/* Barre de recherche */}
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
      </div>

      {/* Liste d'émargement */}
      {loading ? (
        <div className="loading-state">Chargement...</div>
      ) : distributionList.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>Aucun abonné trouvé</h3>
          <p>Aucun abonnement actif pour cette semaine</p>
        </div>
      ) : (
        <div className="distribution-table-container">
          <table className="distribution-table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>Adhérent</th>
                <th>Panier</th>
                <th>Contact</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {distributionList.map((item) => {
                const isPickedUp = item.pickup?.wasPickedUp || false;
                
                return (
                  <tr
                    key={item.subscriptionId}
                    className={isPickedUp ? 'row-picked-up' : 'row-pending'}
                  >
                    <td>
                      <button
                        className={`status-toggle ${isPickedUp ? 'status-picked' : 'status-pending'}`}
                        onClick={() => handleTogglePickup(item)}
                        title={isPickedUp ? 'Marquer comme non récupéré' : 'Marquer comme récupéré'}
                      >
                        {isPickedUp ? (
                          <CheckCircle size={24} />
                        ) : (
                          <Circle size={24} />
                        )}
                      </button>
                    </td>

                    <td>
                      <div className="subscriber-info">
                        <div className="subscriber-name">
                          {item.user.firstName} {item.user.lastName}
                        </div>
                        <div className="subscriber-id">
                          #{item.subscriptionNumber}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`basket-badge basket-${item.basketSize.toLowerCase()}`}>
                        {getBasketSizeLabel(item.basketSize)}
                      </span>
                    </td>

                    <td>
                      <div className="contact-info">
                        <div className="contact-email">{item.user.email}</div>
                        {item.user.phone && (
                          <div className="contact-phone">{item.user.phone}</div>
                        )}
                      </div>
                    </td>

                    <td>
                      {item.pickup?.notes ? (
                        <div className="pickup-notes">
                          <span>{item.pickup.notes}</span>
                        </div>
                      ) : (
                        <span className="no-notes">-</span>
                      )}
                    </td>

                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleAddNote(item)}
                        title="Ajouter une note"
                      >
                        Note
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Récapitulatif */}
      {stats && stats.totalSubscribers > 0 && (
        <div className="distribution-summary">
          <div className="summary-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(stats.pickedUp / stats.totalSubscribers) * 100}%`
                }}
              />
            </div>
            <div className="progress-label">
              {stats.pickedUp} / {stats.totalSubscribers} paniers distribués
            </div>
          </div>
        </div>
      )}
    </div>
  );
}