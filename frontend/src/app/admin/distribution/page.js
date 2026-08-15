'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../../lib/api";
import logger from "../../../lib/logger";
import { longDate, time } from "../../../lib/format";
import { useModal } from "../../../contexts/ModalContext";
import PickupNoteModal from "../../../components/admin/PickupNoteModal";
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
    User,
    AlertCircle
} from "lucide-react";

export default function AdminDistributionPage() {
  const [currentBasket, setCurrentBasket] = useState(null);
  const [distributionList, setDistributionList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [basketError, setBasketError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteTarget, setNoteTarget] = useState(null);

  const { showError } = useModal();
  const debounceRef = useRef(null);

  useEffect(() => {
    fetchCurrentBasket();
  }, []);

  const fetchCurrentBasket = async () => {
    setLoading(true);
    setBasketError(null);
    try {
      const response = await api.weeklyBaskets.getCurrent();
      if (response.data) {
        setCurrentBasket(response.data);
      } else {
        setCurrentBasket(null);
      }
    } catch (error) {
      logger.error('Erreur:', error);
      setCurrentBasket(null);
      setBasketError(error.message || 'Impossible de charger la distribution.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDistributionList = useCallback(async (term) => {
    if (!currentBasket) return;

    setListLoading(true);
    try {
      const params = term ? { search: term } : {};
      const response = await api.distribution.getList(currentBasket.id, params);

      setDistributionList(response.data.list);
      setStats({
        totalSubscribers: response.data.totalSubscribers,
        pickedUp: response.data.pickedUp,
        pending: response.data.pending
      });
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setListLoading(false);
    }
  }, [currentBasket, showError]);

  /* La recherche part vers le serveur après une pause de frappe : le filtrage
     est fait par l'API, un appel par caractère saturerait la liste et les
     réponses pourraient revenir dans le désordre. */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchDistributionList(searchTerm);
    }, searchTerm ? 300 : 0);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, fetchDistributionList]);

  // Remplace le retrait d'une seule ligne, sans toucher au reste de la liste.
  const patchRow = (subscriptionId, pickup) => {
    setDistributionList(list =>
      list.map(row => (row.subscriptionId === subscriptionId ? { ...row, pickup } : row))
    );
  };

  const shiftCounters = (delta) => {
    setStats(current => current && {
      ...current,
      pickedUp: current.pickedUp + delta,
      pending: current.pending - delta,
    });
  };

  /* Pointage optimiste : à la table, la ligne doit réagir au doigt et non au
     réseau. On ne recharge pas la liste — le serveur renvoie le retrait
     enregistré, qu'on fond dans la ligne pour récupérer son identifiant (cas
     d'une première coche) et l'heure de retrait dont l'export a besoin.
     Pas de modale de succès : la ligne qui passe au vert et le compteur qui
     avance sont déjà l'accusé de réception. */
  const handleTogglePickup = async (item) => {
    const newStatus = !item.pickup?.wasPickedUp;

    patchRow(item.subscriptionId, { ...item.pickup, wasPickedUp: newStatus });
    shiftCounters(newStatus ? 1 : -1);

    try {
      const response = item.pickup
        ? await api.distribution.markAsPickedUp(item.pickup.id, {
            wasPickedUp: newStatus,
            weeklyBasketId: currentBasket.id
          })
        : await api.distribution.markAsPickedUp('new', {
            subscriptionId: item.subscriptionId,
            weeklyBasketId: currentBasket.id,
            wasPickedUp: newStatus
          });

      if (response.data) patchRow(item.subscriptionId, response.data);
    } catch (error) {
      // Retour en arrière ciblé : un pointage voisin en cours n'est pas écrasé.
      patchRow(item.subscriptionId, item.pickup);
      shiftCounters(newStatus ? -1 : 1);
      showError('Erreur', error.message);
    }
  };

  const handleNoteClosed = (pickup) => {
    if (pickup) patchRow(noteTarget.subscriptionId, pickup);
    setNoteTarget(null);
  };

  const handleExport = () => {
    try {
      const rows = [
        ['Nom', 'Prénom', 'Email', 'Taille panier', 'Retiré', 'Heure retrait', 'Note'],
        ...distributionList.map(item => [
          item.user?.lastName ?? '',
          item.user?.firstName ?? '',
          item.user?.email ?? '',
          getBasketSizeLabel(item.subscription?.basketSize),
          item.pickup?.wasPickedUp ? 'Oui' : 'Non',
          item.pickup?.pickedUpAt ? time(item.pickup.pickedUpAt) : '',
          item.pickup?.notes ?? '',
        ]),
      ];

      const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `distribution-semaine-${currentBasket?.weekNumber ?? ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError('Erreur', 'Erreur lors de l\'export');
    }
  };

  const getBasketSizeLabel = (size) => {
    return size === 'SMALL' ? 'Petit panier' : 'Grand panier';
  };

  if (loading) {
    return <div className="admin-loading">Chargement...</div>;
  }

  if (basketError) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <AlertCircle size={48} />
          <p>{basketError}</p>
          <button type="button" className="admin-btn-ghost" onClick={fetchCurrentBasket}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

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
            {longDate(currentBasket.distributionDate)} • Semaine {currentBasket.weekNumber}
          </p>
        </div>
        <button className="admin-btn-ghost" onClick={handleExport}>
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
          <label htmlFor="search-distribution" className="sr-only">Rechercher un adhérent</label>
          <Search size={20} aria-hidden="true" />
          <input
            id="search-distribution"
            type="text"
            placeholder="Rechercher un adhérent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Liste d'émargement */}
      {listLoading ? (
        <div className="loading-state">Chargement...</div>
      ) : distributionList.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <h3>Aucun abonné trouvé</h3>
          <p>Aucun abonnement actif pour cette semaine</p>
        </div>
      ) : (
        <div className="distribution-table-container admin-table-container--cards">
          <table className="distribution-table">
            <thead>
              <tr>
                <th scope="col">Statut</th>
                <th scope="col">Adhérent</th>
                <th scope="col">Panier</th>
                <th scope="col">Contact</th>
                <th scope="col">Notes</th>
                <th scope="col">Actions</th>
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
                    <td data-label="Statut">
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

                    <td data-label="Adhérent">
                      <div className="subscriber-info">
                        <div className="subscriber-name">
                          {item.user.firstName} {item.user.lastName}
                        </div>
                        <div className="subscriber-id">
                          #{item.subscriptionNumber}
                        </div>
                      </div>
                    </td>

                    <td data-label="Panier">
                      <span className={`basket-badge basket-${item.basketSize.toLowerCase()}`}>
                        {getBasketSizeLabel(item.basketSize)}
                      </span>
                    </td>

                    <td data-label="Contact">
                      <div className="contact-info">
                        <div className="contact-email">{item.user.email}</div>
                        {item.user.phone && (
                          <div className="contact-phone">{item.user.phone}</div>
                        )}
                      </div>
                    </td>

                    <td data-label="Notes">
                      {item.pickup?.notes ? (
                        <div className="pickup-notes">
                          <span>{item.pickup.notes}</span>
                        </div>
                      ) : (
                        <span className="no-notes">-</span>
                      )}
                    </td>

                    <td data-label="Actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setNoteTarget(item)}
                        title={item.pickup?.notes ? 'Modifier la note' : 'Ajouter une note'}
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

      {noteTarget && (
        <PickupNoteModal
          item={noteTarget}
          weeklyBasketId={currentBasket.id}
          onClose={handleNoteClosed}
        />
      )}
    </div>
  );
}