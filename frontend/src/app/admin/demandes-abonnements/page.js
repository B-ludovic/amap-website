'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { dayMonthYear, longDate, euro, phone, plural } from '../../../lib/format';

/* Les cinq statuts de l'enum RequestStatus. La maquette n'en montrait que
   trois ; « en cours » et « archivée » existent en base et doivent avoir leur
   filtre, sinon une demande mise en liste d'attente disparaît de tous les
   onglets sauf « toutes ». */
const STATUS = {
  PENDING: { label: 'En attente', tone: 'admin-badge-amber' },
  IN_PROGRESS: { label: 'En cours', tone: 'admin-badge-brown' },
  APPROVED: { label: 'Acceptée', tone: 'admin-badge-green' },
  REJECTED: { label: 'Refusée', tone: 'admin-badge-red' },
  ARCHIVED: { label: 'Archivée', tone: '' }
};

const FILTERS = [
  { key: 'PENDING', label: 'En attente' },
  { key: 'IN_PROGRESS', label: 'En cours' },
  { key: 'APPROVED', label: 'Acceptées' },
  { key: 'REJECTED', label: 'Refusées' },
  { key: 'ALL', label: 'Toutes' }
];

const TYPE_LABELS = { ANNUAL: 'Annuel', DISCOVERY: 'Découverte' };
const SIZE_LABELS = {
  SMALL: 'petit panier (2 à 4 kg)',
  LARGE: 'grand panier (6 à 8 kg)'
};
const PRICING_LABELS = { NORMAL: 'Normal', SOLIDARITY: 'Solidaire' };

function formulaOf(request) {
  return `${TYPE_LABELS[request.type] ?? request.type} · ${SIZE_LABELS[request.basketSize] ?? request.basketSize}`;
}

function pricingOf(request) {
  return `${PRICING_LABELS[request.pricingType] ?? request.pricingType} — ${euro(request.price)}`;
}

export default function AdminSubscriptionRequestsPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = useCallback(async (status, wanted) => {
    setLoading(true);
    try {
      const response = await api.subscriptionRequests.getAll({
        page: wanted,
        ...(status === 'ALL' ? {} : { status })
      });
      setRequests(response.data.requests);
      setPagination(response.data.pagination);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchRequests(filter, page);
  }, [filter, page, fetchRequests]);

  const openRequest = (request) => {
    setSelected(request);
    setNotes(request.adminNotes ?? '');
  };

  const closeAndRefresh = () => {
    setSelected(null);
    fetchRequests(filter, page);
  };

  /* L'approbation crée le contrat : elle échoue si le demandeur n'a pas encore
     de compte ou s'il a déjà un abonnement vivant. On laisse remonter le
     message du serveur, qui dit précisément lequel des deux cas s'applique. */
  const handleApprove = () => {
    const request = selected;
    showConfirm(
      'Accepter la demande',
      `Créer le contrat de ${request.firstName} ${request.lastName} pour ${euro(request.price)} ?`,
      async () => {
        setSaving(true);
        try {
          await api.subscriptionRequests.approve(request.id, notes);
          showSuccess('Demande acceptée', 'Le contrat a été créé, en attente de règlement.');
          closeAndRefresh();
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const updateStatus = async (status, successMessage) => {
    setSaving(true);
    try {
      await api.subscriptionRequests.updateStatus(selected.id, { status, adminNotes: notes });
      showSuccess('Demande mise à jour', successMessage);
      closeAndRefresh();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = () => {
    showConfirm(
      'Refuser la demande',
      `Refuser la demande de ${selected.firstName} ${selected.lastName} ? Le demandeur en sera informé.`,
      () => updateStatus('REJECTED', 'La demande a été refusée.')
    );
  };

  const pendingCount = requests.filter(request => request.status === 'PENDING').length;

  return (
    <div className="admin-requests">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Demandes d&apos;abonnements</h1>
          <p className="admin-title-lead">
            {filter === 'PENDING'
              ? `${requests.length} ${plural(requests.length, 'demande', 'demandes')} en attente de traitement.`
              : `${requests.length} ${plural(requests.length, 'demande', 'demandes')} — dont ${pendingCount} en attente.`}
          </p>
        </div>
      </div>

      <div className="admin-pills">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            className={`admin-pill ${filter === item.key ? 'admin-pill-active' : ''}`}
            onClick={() => { setFilter(item.key); setPage(1); }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : requests.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucune demande</p>
          <p className="admin-empty-card-note">Rien à traiter avec ce filtre.</p>
        </div>
      ) : (
        <div className="admin-grid-2">
          {requests.map((request) => {
            const status = STATUS[request.status] ?? { label: request.status, tone: '' };

            return (
              <article key={request.id} className="admin-panel">
                <div className="admin-item-head">
                  <div>
                    <h2 className="admin-item-title">{request.firstName} {request.lastName}</h2>
                    <p className="admin-item-meta">Reçue le {dayMonthYear(request.createdAt)}</p>
                  </div>
                  <span className={`admin-badge ${status.tone}`}>{status.label}</span>
                </div>

                <div className="admin-item-body">
                  <dl className="def-list admin-mini-def">
                    <div className="def-row">
                      <dt className="def-label">Contact</dt>
                      <dd className="def-value def-value-mono">
                        {request.email}
                        <br />
                        {phone(request.phone)}
                      </dd>
                    </div>
                    <div className="def-row">
                      <dt className="def-label">Formule</dt>
                      <dd className="def-value">{formulaOf(request)}</dd>
                    </div>
                    <div className="def-row">
                      <dt className="def-label">Tarif</dt>
                      <dd className="def-value">{pricingOf(request)}</dd>
                    </div>
                  </dl>

                  {request.message && (
                    <p className="admin-quote admin-quote-compact" style={{ marginTop: '16px' }}>
                      {request.message}
                    </p>
                  )}

                  <div className="admin-item-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => openRequest(request)}>
                      {request.status === 'PENDING' || request.status === 'IN_PROGRESS'
                        ? 'Traiter la demande'
                        : 'Voir le détail'}
                    </button>
                    {request.status === 'APPROVED' && (
                      <button
                        type="button"
                        className="admin-btn-ghost"
                        onClick={() => api.subscriptionRequests.downloadContract(request.id)
                          .catch(error => showError('Erreur', error.message))}
                      >
                        Télécharger le contrat
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
      />

      {selected && (
        <AdminModal title="Demande d'abonnement" width="720px" onClose={() => setSelected(null)}>
          <div className="admin-facts">
            <div>
              <span className="admin-field-label">Demandeur</span>
              <div className="admin-fact-value">{selected.firstName} {selected.lastName}</div>
            </div>
            <div>
              <span className="admin-field-label">Reçue le</span>
              <div className="admin-fact-value admin-fact-value-mono">{longDate(selected.createdAt)}</div>
            </div>
            <div>
              <span className="admin-field-label">Email</span>
              <div className="admin-fact-value admin-fact-value-mono">{selected.email}</div>
            </div>
            <div>
              <span className="admin-field-label">Téléphone</span>
              <div className="admin-fact-value admin-fact-value-mono">{phone(selected.phone)}</div>
            </div>
            <div>
              <span className="admin-field-label">Formule demandée</span>
              <div className="admin-fact-value">{formulaOf(selected)}</div>
            </div>
            <div>
              <span className="admin-field-label">Tarification</span>
              <div className="admin-fact-value admin-fact-value-mono">{pricingOf(selected)}</div>
            </div>
          </div>

          {selected.message && (
            <div style={{ marginBottom: '24px' }}>
              <span className="admin-field-label">Message du demandeur</span>
              <p className="admin-quote">{selected.message}</p>
            </div>
          )}

          <div style={{ marginBottom: '26px' }}>
            <label htmlFor="admin-request-notes" className="admin-field-label">Notes internes</label>
            <textarea
              id="admin-request-notes"
              className="admin-textarea"
              rows={3}
              placeholder="Notes internes (paiement reçu, remarques, etc.)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="admin-modal-actions">
            {selected.status !== 'APPROVED' && (
              <button type="button" className="admin-btn-forest" onClick={handleApprove} disabled={saving}>
                Accepter et créer le contrat
              </button>
            )}
            {selected.status === 'PENDING' && (
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => updateStatus('IN_PROGRESS', 'La demande passe en liste d\'attente.')}
                disabled={saving}
              >
                Mettre en liste d&apos;attente
              </button>
            )}
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => updateStatus(selected.status, 'Les notes internes ont été enregistrées.')}
              disabled={saving}
            >
              Enregistrer les notes
            </button>
            {selected.status !== 'REJECTED' && (
              <span className="admin-modal-actions-end">
                <button type="button" className="admin-btn-danger" onClick={handleReject} disabled={saving}>
                  Refuser
                </button>
              </span>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  );
}
