'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import { monthYear, numericDate, euro, plural } from '../../../lib/format';
import '../../../styles/admin/subscriptions.css';

const STATUS = {
  ACTIVE: { label: 'Actif', tone: 'admin-badge-green' },
  PAUSED: { label: 'En pause', tone: 'admin-badge-brown' },
  PENDING: { label: 'En attente', tone: 'admin-badge-amber' },
  EXPIRED: { label: 'Expiré', tone: '' },
  CANCELLED: { label: 'Résilié', tone: 'admin-badge-red' }
};

const TYPE_LABELS = { ANNUAL: 'Annuel', DISCOVERY: 'Découverte' };
const SIZE_LABELS = { SMALL: 'Petit', LARGE: 'Grand' };
const PRICING_LABELS = { NORMAL: 'Normal', SOLIDARITY: 'Solidaire' };

/* Le backend plafonne le total des pauses à quatorze jours par contrat.
   La fiche annonce ce qu'il reste, calculé sur la même base. */
const PAUSE_DAYS_ALLOWED = 14;
const DAY_MS = 86400000;
const PAGE_SIZE = 20;

function periodOf(subscription) {
  return `${monthYear(subscription.startDate)} → ${monthYear(subscription.endDate)}`;
}

function pauseDaysUsed(pauses = []) {
  return pauses.reduce((total, pause) => {
    const start = new Date(pause.startDate);
    const end = new Date(pause.endDate);
    return total + Math.max(0, Math.round((end - start) / DAY_MS) + 1);
  }, 0);
}

export default function AdminSubscriptionsPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const debounceRef = useRef(null);

  const fetchSubscriptions = useCallback(async (filters) => {
    setLoading(true);
    try {
      const response = await api.subscriptions.getAll({
        page: filters.page,
        limit: PAGE_SIZE,
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
        ...(filters.search && { search: filters.search })
      });
      setSubscriptions(response.data.subscriptions);
      setPagination(response.data.pagination);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les abonnements.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSubscriptions({ search, status, type, page });
    }, search ? 300 : 0);

    return () => clearTimeout(debounceRef.current);
  }, [search, status, type, page, fetchSubscriptions]);

  /* La ligne de liste ne porte ni les règlements ni les permanences : on
     recharge la fiche complète à l'ouverture. */
  const openSubscription = async (subscription) => {
    try {
      const response = await api.subscriptions.getById(subscription.id);
      setSelected(response.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger cet abonnement.');
    }
  };

  const refresh = () => {
    setSelected(null);
    fetchSubscriptions({ search, status, type, page });
  };

  const handleContract = async () => {
    try {
      const url = await api.subscriptions.getContractBlobUrl(selected.id);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const handlePause = () => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 6);

    showConfirm(
      'Mettre en pause',
      `Suspendre le contrat ${selected.subscriptionNumber} pour une semaine, à partir d'aujourd'hui ?`,
      async () => {
        setBusy(true);
        try {
          await api.subscriptions.pause(selected.id, {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          });
          showSuccess('Contrat suspendu', 'La pause a été enregistrée.');
          refresh();
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setBusy(false);
        }
      }
    );
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      await api.subscriptions.resume(selected.id);
      showSuccess('Contrat repris', 'Le contrat est de nouveau actif.');
      refresh();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    showConfirm(
      'Résilier le contrat',
      `Résilier ${selected.subscriptionNumber} ? L'adhérent ne recevra plus de panier.`,
      async () => {
        setBusy(true);
        try {
          await api.subscriptions.cancel(selected.id);
          showSuccess('Contrat résilié', 'Le contrat a été résilié.');
          refresh();
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setBusy(false);
        }
      }
    );
  };

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const selectedStatus = selected ? (STATUS[selected.status] ?? { label: selected.status, tone: '' }) : null;
  const daysUsed = selected ? pauseDaysUsed(selected.pauses) : 0;
  const paid = selected ? selected.paidAmount : 0;
  const due = selected ? Math.max(0, selected.price - selected.paidAmount) : 0;

  return (
    <div className="admin-subs">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Abonnements</h1>
          <p className="admin-title-lead">
            {pagination.total} {plural(pagination.total, 'contrat', 'contrats')} enregistrés.
          </p>
        </div>
      </div>

      <div className="admin-toolbar-da">
        <label htmlFor="admin-subs-search" className="sr-only">Rechercher un adhérent</label>
        <input
          id="admin-subs-search"
          type="text"
          className="admin-search-field"
          placeholder="Rechercher un adhérent…"
          value={search}
          onChange={changeFilter(setSearch)}
        />

        <label htmlFor="admin-subs-status" className="sr-only">Filtrer par statut</label>
        <select id="admin-subs-status" className="admin-select" value={status} onChange={changeFilter(setStatus)}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="PAUSED">En pause</option>
          <option value="PENDING">En attente</option>
          <option value="EXPIRED">Expirés</option>
          <option value="CANCELLED">Résiliés</option>
        </select>

        <label htmlFor="admin-subs-type" className="sr-only">Filtrer par type</label>
        <select id="admin-subs-type" className="admin-select" value={type} onChange={changeFilter(setType)}>
          <option value="">Tous les types</option>
          <option value="ANNUAL">Annuel</option>
          <option value="DISCOVERY">Découverte</option>
        </select>

        <span className="admin-toolbar-count">
          {pagination.total} {plural(pagination.total, 'contrat', 'contrats')}
        </span>
      </div>

      <div className="admin-panel admin-subs-table">
        <div className="admin-table-head">
          <span>N°</span>
          <span>Adhérent</span>
          <span>Type</span>
          <span className="admin-subs-size">Panier</span>
          <span>Période</span>
          <span>Statut</span>
          <span className="admin-subs-pickups-cell">Retraits</span>
          <span className="admin-cell-right">Action</span>
        </div>

        {loading ? (
          <p className="admin-empty">Chargement…</p>
        ) : subscriptions.length === 0 ? (
          <p className="admin-empty">Aucun abonnement ne correspond à ces filtres.</p>
        ) : (
          subscriptions.map((subscription) => {
            const state = STATUS[subscription.status] ?? { label: subscription.status, tone: '' };

            return (
              <div key={subscription.id} className="admin-table-row">
                <span className="admin-subs-ref">{subscription.subscriptionNumber}</span>
                <span className="admin-cell-strong">
                  {subscription.user?.firstName} {subscription.user?.lastName}
                </span>
                <span className="admin-cell-muted">{TYPE_LABELS[subscription.type] ?? subscription.type}</span>
                <span className="admin-cell-muted admin-subs-size">
                  {SIZE_LABELS[subscription.basketSize] ?? subscription.basketSize}
                </span>
                <span className="admin-subs-period">{periodOf(subscription)}</span>
                <span>
                  <span className={`admin-badge ${state.tone}`}>{state.label}</span>
                </span>
                <span className="admin-subs-pickups admin-subs-pickups-cell">
                  {subscription.pickupsRemaining}
                </span>
                <span className="admin-cell-right">
                  <button type="button" className="admin-btn-link" onClick={() => openSubscription(subscription)}>
                    Détail
                  </button>
                </span>
              </div>
            );
          })
        )}

        {pagination.totalPages > 1 && (
          <div className="admin-pager">
            <span className="admin-pager-state">
              Page {pagination.page} sur {pagination.totalPages}
            </span>
            <div className="admin-pager-controls">
              <button
                type="button"
                className="admin-btn-link"
                disabled={pagination.page <= 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                ← Précédent
              </button>
              <button
                type="button"
                className="admin-btn-link"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(current => current + 1)}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <AdminModal title="Détails de l'abonnement" width="700px" onClose={() => setSelected(null)}>
          <div className="admin-sub-identity">
            <span className="admin-sub-identity-ref">{selected.subscriptionNumber}</span>
            <span className="admin-sub-identity-name">
              {selected.user?.firstName} {selected.user?.lastName}
            </span>
            <span className={`admin-badge ${selectedStatus.tone}`}>{selectedStatus.label}</span>
          </div>

          <div className="admin-sub-summary">
            <div>
              <span className="admin-field-label">Formule</span>
              <div className="admin-sub-summary-value">
                {TYPE_LABELS[selected.type] ?? selected.type} · {(SIZE_LABELS[selected.basketSize] ?? selected.basketSize).toLowerCase()} panier
              </div>
            </div>
            <div>
              <span className="admin-field-label">Période</span>
              <div className="admin-sub-summary-value admin-sub-summary-value-mono">{periodOf(selected)}</div>
            </div>
            <div>
              <span className="admin-field-label">Retraits restants</span>
              <div className="admin-sub-summary-value admin-sub-summary-value-mono">
                {selected.pickupsRemaining} sur {selected.pickupsRemaining + selected.pickupsDone}
              </div>
            </div>
          </div>

          <dl className="def-list admin-sub-follow">
            <div className="def-row">
              <dt className="def-label">Règlement</dt>
              <dd className="def-value">
                {euro(selected.price)} · {euro(paid)} encaissé
                {due > 0 ? ` · reste ${euro(due)}` : ' · soldé'}
                {selected.payments?.length > 0 && ` · ${selected.payments.length} ${plural(selected.payments.length, 'versement', 'versements')}`}
              </dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Pauses posées</dt>
              <dd className="def-value">
                {selected.pauses?.length > 0
                  ? `${selected.pauses.length} ${plural(selected.pauses.length, 'pause', 'pauses')} · ${daysUsed} ${plural(daysUsed, 'jour utilisé', 'jours utilisés')} sur ${PAUSE_DAYS_ALLOWED}`
                  : `Aucune · ${PAUSE_DAYS_ALLOWED} jours disponibles`}
              </dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Permanences</dt>
              <dd className="def-value">
                {selected.user?._count?.shiftVolunteers ?? 0} {plural(selected.user?._count?.shiftVolunteers ?? 0, 'créneau tenu', 'créneaux tenus')}
              </dd>
            </div>
            <div className="def-row">
              <dt className="def-label">Point de retrait</dt>
              <dd className="def-value">{selected.pickupLocation?.name ?? '—'}</dd>
            </div>
            {selected.pickups?.length > 0 && (
              <div className="def-row">
                <dt className="def-label">Dernier retrait</dt>
                <dd className="def-value">
                  {numericDate(selected.pickups[0].pickupDate)} · {selected.pickupsDone} au total
                </dd>
              </div>
            )}
          </dl>

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-primary" onClick={handleContract}>
              Générer le contrat PDF
            </button>
            {selected.status === 'ACTIVE' && (
              <button type="button" className="admin-btn-ghost" onClick={handlePause} disabled={busy}>
                Mettre en pause
              </button>
            )}
            {selected.status === 'PAUSED' && (
              <button type="button" className="admin-btn-ghost" onClick={handleResume} disabled={busy}>
                Reprendre
              </button>
            )}
            {selected.status !== 'CANCELLED' && (
              <span className="admin-modal-actions-end">
                <button type="button" className="admin-btn-danger" onClick={handleCancel} disabled={busy}>
                  Résilier
                </button>
              </span>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  );
}
