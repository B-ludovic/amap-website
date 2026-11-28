'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { dayMonthYear, plural } from '../../../lib/format';
import '../../../styles/admin/producer-access.css';

const STATUS = {
  PENDING: { label: 'En attente', tone: 'admin-badge-amber' },
  APPROVED: { label: 'Accordée', tone: 'admin-badge-green' },
  REJECTED: { label: 'Refusée', tone: 'admin-badge-red' },
  REVOKED: { label: 'Révoquée', tone: '' }
};

const FILTERS = [
  { key: 'PENDING', label: 'En attente' },
  { key: 'APPROVED', label: 'Accordées' },
  { key: 'REJECTED', label: 'Refusées' },
  { key: 'REVOKED', label: 'Révoquées' },
  { key: 'ALL', label: 'Toutes' }
];

const ROLE_LABEL = { MEMBER: 'Adhérent', VOLUNTEER: 'Bénévole', ADMIN: 'Administrateur', PRODUCER: 'Producteur' };

const nameOf = (request) => (
  request.user.deletedAt ? 'Compte supprimé' : `${request.user.firstName} ${request.user.lastName}`
);

// Le compteur du menu se relit après chaque geste.
const announceChange = () => window.dispatchEvent(new Event('producer-access-changed'));

function AdminProducerAccess() {
  const { showConfirm, showSuccess, showError } = useModal();
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // ?statut=APPROVED : l'écran Utilisateurs ouvre la file sur les accès accordés.
  const [filter, setFilter] = useState(() => {
    const wanted = searchParams.get('statut');
    return FILTERS.some((item) => item.key === wanted) ? wanted : 'PENDING';
  });
  const [farms, setFarms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [producerId, setProducerId] = useState('');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // L'état de chargement se pose dans les gestes qui changent de liste, pas ici.
  const fetchRequests = useCallback((status, wanted) => api.producerAccessRequests.getAll({
    page: wanted,
    ...(status === 'ALL' ? {} : { status })
  })
    .then((response) => {
      setRequests(response.data.requests);
      setPagination(response.data.pagination);
    })
    .catch((error) => showError('Erreur', error.message))
    .finally(() => setLoading(false)), [showError]);

  const showList = (nextFilter, nextPage) => {
    if (nextFilter === filter && nextPage === page) return;
    setLoading(true);
    setFilter(nextFilter);
    setPage(nextPage);
  };

  useEffect(() => {
    fetchRequests(filter, page);
  }, [filter, page, fetchRequests]);

  // Fiches proposables : actives et hors exemple, comme l'exige l'approbation.
  useEffect(() => {
    api.admin.producers.getAll()
      .then((response) => setFarms(response.data.filter((farm) => farm.isActive && !farm.isExample)))
      .catch((error) => showError('Erreur', error.message));
  }, [showError]);

  const openRequest = (request) => {
    setSelected(request);
    setProducerId('');
    setNotes('');
    setPassword('');
  };

  const run = async (action) => {
    setBusy(true);
    try {
      const response = await action();
      showSuccess('Demande d\'accès', response.message);
      setSelected(null);
      announceChange();
      fetchRequests(filter, page);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  const handleApprove = () => {
    const farm = farms.find((item) => item.id === producerId);
    showConfirm(
      'Accorder l\'accès',
      `Rattacher ${nameOf(selected)} à ${farm?.name} ? Son compte devient producteur et sa session en cours se ferme.`,
      () => run(() => api.producerAccessRequests.approve(selected.id, {
        producerId,
        adminNotes: notes || undefined,
        password
      }))
    );
  };

  const handleReject = () => {
    showConfirm(
      'Refuser la demande',
      `Refuser la demande de ${nameOf(selected)} ? Une nouvelle demande lui sera possible dans trente jours.`,
      () => run(() => api.producerAccessRequests.reject(selected.id, { adminNotes: notes || undefined }))
    );
  };

  const handleRevoke = () => {
    const role = ROLE_LABEL[selected.previousRole ?? 'MEMBER']?.toLowerCase();
    showConfirm(
      'Retirer l\'accès',
      `Retirer l'accès producteur de ${nameOf(selected)} ? Son compte redevient ${role} et sa session en cours se ferme.`,
      () => run(() => api.producerAccessRequests.revoke(selected.id, password))
    );
  };

  const isPending = selected?.status === 'PENDING';
  const isApproved = selected?.status === 'APPROVED';

  return (
    <div className="admin-access">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Demandes d&apos;accès</h1>
          <p className="admin-title-lead">
            {pagination.total} {plural(pagination.total, 'demande', 'demandes')}
            {filter === 'PENDING' ? ' à étudier.' : ' avec ce filtre.'}
          </p>
        </div>
      </div>

      <div className="admin-pills">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            className={`admin-pill ${filter === item.key ? 'admin-pill-active' : ''}`}
            onClick={() => showList(item.key, 1)}
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
          <p className="admin-empty-card-note">Rien à étudier avec ce filtre.</p>
        </div>
      ) : (
        <div className="admin-grid-2">
          {requests.map((request) => {
            const status = STATUS[request.status] ?? { label: request.status, tone: '' };

            return (
              <article key={request.id} className="admin-panel">
                <div className="admin-item-head">
                  <div>
                    <h2 className="admin-item-title">{nameOf(request)}</h2>
                    {!request.user.deletedAt && <p className="admin-item-contact">{request.user.email}</p>}
                    <p className="admin-item-meta">Reçue le {dayMonthYear(request.createdAt)}</p>
                  </div>
                  <span className={`admin-badge ${status.tone}`}>{status.label}</span>
                </div>

                <div className="admin-item-body">
                  <dl className="def-list admin-mini-def admin-inquiry-def">
                    <div className="def-row">
                      <dt className="def-label">Ferme déclarée</dt>
                      <dd className="def-value admin-access-claim">{request.farmClaim}</dd>
                    </div>
                    {request.producer && (
                      <div className="def-row">
                        <dt className="def-label">Fiche rattachée</dt>
                        <dd className="def-value">{request.producer.name ?? 'Fiche supprimée'}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="admin-item-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => openRequest(request)}>
                      {request.status === 'PENDING' ? 'Étudier la demande' : 'Voir le détail'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminPagination
        page={pagination.page}
        totalPages={pagination.pages}
        onPageChange={(wanted) => showList(filter, wanted)}
      />

      {selected && (
        <AdminModal title="Demande d'accès producteur" width="640px" onClose={() => setSelected(null)}>
          <div className="admin-facts">
            <div>
              <span className="admin-field-label">Compte</span>
              <div className="admin-fact-value">{nameOf(selected)}</div>
            </div>
            <div>
              <span className="admin-field-label">Email</span>
              <div className="admin-fact-value admin-fact-value-mono">
                {selected.user.deletedAt ? '—' : selected.user.email}
              </div>
            </div>
            <div>
              <span className="admin-field-label">Rôle actuel</span>
              <div className="admin-fact-value">{ROLE_LABEL[selected.user.role] ?? selected.user.role}</div>
            </div>
            <div>
              <span className="admin-field-label">Reçue le</span>
              <div className="admin-fact-value">{dayMonthYear(selected.createdAt)}</div>
            </div>
            {selected.producer && (
              <div>
                <span className="admin-field-label">Fiche rattachée</span>
                <div className="admin-fact-value">{selected.producer.name ?? 'Fiche supprimée'}</div>
              </div>
            )}
            {selected.processedAt && (
              <div>
                <span className="admin-field-label">Traitée le</span>
                <div className="admin-fact-value">{dayMonthYear(selected.processedAt)}</div>
              </div>
            )}
            {selected.revokedAt && (
              <div>
                <span className="admin-field-label">Révoquée le</span>
                <div className="admin-fact-value">{dayMonthYear(selected.revokedAt)}</div>
              </div>
            )}
          </div>

          <div className="admin-access-block">
            <span className="admin-field-label">Ferme déclarée</span>
            <p className="admin-quote admin-access-claim">{selected.farmClaim}</p>
          </div>

          {isPending ? (
            <>
              <div className="admin-access-block">
                <label htmlFor="admin-access-farm" className="admin-field-label">Fiche de la ferme</label>
                <select
                  id="admin-access-farm"
                  className="admin-select-full"
                  value={producerId}
                  onChange={(event) => setProducerId(event.target.value)}
                >
                  <option value="">Choisir une fiche</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>{farm.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-access-block">
                <label htmlFor="admin-access-notes" className="admin-field-label">Notes internes</label>
                <textarea
                  id="admin-access-notes"
                  className="admin-textarea"
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  aria-describedby="admin-access-notes-hint"
                />
                <p id="admin-access-notes-hint" className="admin-access-hint">
                  Jamais montrées au demandeur.
                </p>
              </div>
            </>
          ) : selected.adminNotes && (
            <div className="admin-access-block">
              <span className="admin-field-label">Notes internes</span>
              <p className="admin-fact-value admin-access-claim">{selected.adminNotes}</p>
            </div>
          )}

          {(isPending || isApproved) && (
            <div className="admin-access-block">
              <label htmlFor="admin-access-password" className="admin-field-label">Votre mot de passe</label>
              <input
                id="admin-access-password"
                type="password"
                className="admin-input"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="admin-access-password-hint"
              />
              <p id="admin-access-password-hint" className="admin-access-hint">
                Demandé pour accorder ou retirer un accès. Le journal garde la trace des refus.
              </p>
            </div>
          )}

          {isPending && (
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-btn-forest"
                onClick={handleApprove}
                disabled={busy || !producerId || !password}
              >
                Accorder l&apos;accès
              </button>
              <span className="admin-modal-actions-end">
                <button type="button" className="admin-btn-danger" onClick={handleReject} disabled={busy}>
                  Refuser
                </button>
              </span>
            </div>
          )}

          {isApproved && (
            <div className="admin-modal-actions">
              <span className="admin-modal-actions-end">
                <button type="button" className="admin-btn-danger" onClick={handleRevoke} disabled={busy || !password}>
                  Retirer l&apos;accès
                </button>
              </span>
            </div>
          )}
        </AdminModal>
      )}
    </div>
  );
}

export default function AdminProducerAccessPage() {
  return (
    <Suspense fallback={<p className="admin-empty">Chargement…</p>}>
      <AdminProducerAccess />
    </Suspense>
  );
}
