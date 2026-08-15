'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import ChequesModal from '../../../components/admin/ChequesModal';
import ChequeCorrectionModal from '../../../components/admin/ChequeCorrectionModal';
import { monthYear, numericDate, euro, plural } from '../../../lib/format';
import '../../../styles/admin/subscriptions.css';

/* Le statut d'un chèque décrit un lieu — la pochette du trésorier, la banque, le
   compte — plutôt qu'un état abstrait. « acquis » marque ceux dont la date
   affichée est un fait accompli et non une échéance à venir. */
const CHEQUE_STATUS = {
  RECEIVED: { label: 'En main', tone: 'admin-badge-amber', acquis: false },
  DEPOSITED: { label: 'Déposé', tone: 'admin-badge-brown', acquis: true },
  SUCCEEDED: { label: 'Encaissé', tone: 'admin-badge-green', acquis: true },
  FAILED: { label: 'Rejeté', tone: 'admin-badge-red', acquis: true },
  RETURNED: { label: 'Rendu', tone: '', acquis: true }
};

/* Le pas suivant du chèque, quand il en a un. Ces deux mouvements suivent le
   trajet du papier et se font d'un clic : c'est le geste répété du trésorier.
   Tout le reste passe par la correction, et donc par le mot de passe. */
const NEXT_STEP = {
  RECEIVED: { status: 'DEPOSITED', label: 'Déposer en banque' },
  DEPOSITED: { status: 'SUCCEEDED', label: 'Marquer encaissé' }
};

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
  const [chequesOpen, setChequesOpen] = useState(false);
  const [chequeACorriger, setChequeACorriger] = useState(null);

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

  /* Déplacer un chèque ne clôt pas la fiche : le trésorier en pointe plusieurs à
     la suite. On recharge donc le contrat sous les yeux plutôt que de refermer,
     et la liste en arrière-plan, dont le règlement a changé. */
  const reloadSelected = async () => {
    try {
      const response = await api.subscriptions.getById(selected.id);
      setSelected(response.data);
      fetchSubscriptions({ search, status, type, page });
    } catch (error) {
      showError('Erreur', 'Impossible de recharger ce contrat.');
    }
  };

  const avancerCheque = async (cheque) => {
    const pas = NEXT_STEP[cheque.status];
    if (!pas) return;

    setBusy(true);
    try {
      await api.subscriptions.updateCheque(selected.id, cheque.id, { status: pas.status });
      await reloadSelected();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
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
  const due = selected ? Math.max(0, selected.price - selected.paidAmount) : 0;

  /* Les chèques ne se saisissent qu'une fois. Tant qu'aucun n'est enregistré et
     que le contrat n'est pas clos, la remise reste à faire — y compris sur un
     contrat déjà actif, cas de ceux créés avant ce suivi. */
  const cheques = selected?.payments ?? [];
  const remiseAFaire = selected !== null
    && cheques.length === 0
    && selected.status !== 'CANCELLED'
    && selected.status !== 'EXPIRED';

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

        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
        />
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
                {cheques.length === 0
                  ? `${euro(selected.price)} · aucun chèque enregistré`
                  : `${euro(selected.price)} · ${cheques.length} ${plural(cheques.length, 'chèque remis', 'chèques remis')}`
                    + (due > 0 ? ` · reste ${euro(due)}` : ' · couvert')}
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

          {/* Les chèques eux-mêmes. « X € encaissé » ne disait pas où était
              l'argent : détenu par l'association, parti en banque, ou crédité.
              Chaque bande le dit, avec la date à laquelle elle doit partir. */}
          {cheques.length > 0 && (
            <div className="admin-cheques-list">
              {cheques.map((cheque, index) => {
                const etat = CHEQUE_STATUS[cheque.status] ?? { label: cheque.status, tone: '', acquis: true };
                return (
                  <article key={cheque.id} className="admin-cheques-row">
                    <span className="admin-cheques-row-rank">{index + 1}</span>
                    <span className="admin-cheques-row-amount">{euro(cheque.amount)}</span>
                    <span className="admin-cheques-row-date">
                      {etat.acquis
                        ? numericDate(cheque.depositedAt ?? cheque.paidAt ?? cheque.dueDate)
                        : `à déposer le ${numericDate(cheque.dueDate)}`}
                    </span>
                    {cheque.checkNumber && (
                      <span className="admin-cheques-row-number">n° {cheque.checkNumber}</span>
                    )}
                    <span className={`admin-badge ${etat.tone}`}>{etat.label}</span>
                    <span className="admin-cheques-row-actions">
                      {NEXT_STEP[cheque.status] && (
                        <button
                          type="button"
                          className="admin-btn-link"
                          onClick={() => avancerCheque(cheque)}
                          disabled={busy}
                        >
                          {NEXT_STEP[cheque.status].label}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn-link"
                        onClick={() => setChequeACorriger(cheque)}
                        disabled={busy}
                      >
                        Corriger
                      </button>
                    </span>
                  </article>
                );
              })}
            </div>
          )}

          <div className="admin-modal-actions">
            {/* L'activation n'est plus un geste séparé : elle découle de la
                remise. Un contrat actif a donc toujours son règlement en face. */}
            {remiseAFaire && (
              <button type="button" className="admin-btn-primary" onClick={() => setChequesOpen(true)}>
                Chèques reçus
              </button>
            )}
            <button type="button" className="admin-btn-ghost" onClick={handleContract}>
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

      {selected && chequesOpen && (
        <ChequesModal
          subscription={selected}
          onClose={() => setChequesOpen(false)}
          onRecorded={() => {
            setChequesOpen(false);
            showSuccess('Chèques enregistrés', 'Le règlement est rattaché au contrat.');
            refresh();
          }}
        />
      )}

      {selected && chequeACorriger && (
        <ChequeCorrectionModal
          subscriptionId={selected.id}
          cheque={chequeACorriger}
          onClose={() => setChequeACorriger(null)}
          onCorrected={async () => {
            setChequeACorriger(null);
            showSuccess('Correction enregistrée', 'Le journal en garde la trace.');
            await reloadSelected();
          }}
        />
      )}
    </div>
  );
}
