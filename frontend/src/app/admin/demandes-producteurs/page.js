'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { dayMonthYear, phone, plural } from '../../../lib/format';

const STATUS = {
  PENDING: { label: 'En attente', tone: 'admin-badge-amber' },
  IN_PROGRESS: { label: 'À l\'étude', tone: 'admin-badge-brown' },
  ACCEPTED: { label: 'Acceptée', tone: 'admin-badge-green' },
  REJECTED: { label: 'Refusée', tone: 'admin-badge-red' },
  ARCHIVED: { label: 'Archivée', tone: '' }
};

const FILTERS = [
  { key: 'PENDING', label: 'En attente' },
  { key: 'IN_PROGRESS', label: 'À l\'étude' },
  { key: 'ACCEPTED', label: 'Acceptées' },
  { key: 'REJECTED', label: 'Refusées' },
  { key: 'ALL', label: 'Toutes' }
];

/* La maquette écrit « Sèvres (92310) · 9 km du point de retrait ». La distance
   est facultative en base : sans elle, on s'arrête à la commune. */
function locationOf(inquiry) {
  const town = `${inquiry.city} (${inquiry.postalCode})`;
  return inquiry.distance
    ? `${town} · ${inquiry.distance} km du point de retrait`
    : town;
}

/* La maquette montre « Certifiée AB depuis 2019 » ou « En conversion ». Le
   champ libre `certifications` porte cette phrase quand elle a été saisie ;
   sinon on retombe sur la case bio, seule information certaine. */
function certificationOf(inquiry) {
  if (inquiry.certifications) return inquiry.certifications;
  return inquiry.isBio ? 'Agriculture biologique' : 'Non renseignée';
}

export default function AdminProducerInquiriesPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [inquiries, setInquiries] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchInquiries = useCallback(async (status, wanted) => {
    setLoading(true);
    try {
      const response = await api.producerInquiries.getAll({
        page: wanted,
        ...(status === 'ALL' ? {} : { status })
      });
      setInquiries(response.data.inquiries);
      setPagination(response.data.pagination);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchInquiries(filter, page);
  }, [filter, page, fetchInquiries]);

  const openInquiry = (inquiry) => {
    setSelected(inquiry);
    setNotes(inquiry.adminNotes ?? '');
  };

  const applyStatus = async (status, options = {}) => {
    setBusy(true);
    try {
      await api.producerInquiries.updateStatus(selected.id, {
        status,
        adminNotes: notes,
        ...options
      });
      showSuccess('Candidature mise à jour', options.successMessage ?? 'Le statut a été enregistré.');
      setSelected(null);
      fetchInquiries(filter, page);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  /* Accepter crée la fiche producteur dans la foulée : c'est ce que fait déjà
     le backend quand on lui passe createProducer. La confirmation le dit, pour
     que personne ne découvre la fiche après coup. */
  const handleAccept = () => {
    showConfirm(
      'Accepter la candidature',
      `Accepter ${selected.farmName} et créer sa fiche producteur ? Un email de réponse partira vers ${selected.email}.`,
      () => applyStatus('ACCEPTED', {
        createProducer: true,
        successMessage: 'La candidature est acceptée et la fiche producteur créée.'
      })
    );
  };

  const handleReject = () => {
    showConfirm(
      'Refuser la candidature',
      `Refuser ${selected.farmName} ? Un email de réponse partira vers ${selected.email}.`,
      () => applyStatus('REJECTED', { successMessage: 'La candidature a été refusée.' })
    );
  };

  return (
    <div className="admin-inquiries">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Demandes producteurs</h1>
          <p className="admin-title-lead">
            {inquiries.length} {plural(inquiries.length, 'candidature', 'candidatures')}
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
            onClick={() => { setFilter(item.key); setPage(1); }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : inquiries.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucune candidature</p>
          <p className="admin-empty-card-note">Rien à étudier avec ce filtre.</p>
        </div>
      ) : (
        <div className="admin-grid-2">
          {inquiries.map((inquiry) => {
            const status = STATUS[inquiry.status] ?? { label: inquiry.status, tone: '' };

            return (
              <article key={inquiry.id} className="admin-panel">
                <div className="admin-item-head">
                  <div>
                    <h2 className="admin-item-title">{inquiry.farmName}</h2>
                    <p className="admin-item-contact">{inquiry.firstName} {inquiry.lastName}</p>
                    <p className="admin-item-meta">Reçue le {dayMonthYear(inquiry.createdAt)}</p>
                  </div>
                  <span className={`admin-badge ${status.tone}`}>{status.label}</span>
                </div>

                <div className="admin-item-body">
                  <dl className="def-list admin-mini-def admin-inquiry-def">
                    <div className="def-row">
                      <dt className="def-label">Localisation</dt>
                      <dd className="def-value">{locationOf(inquiry)}</dd>
                    </div>
                    <div className="def-row">
                      <dt className="def-label">Production</dt>
                      <dd className="def-value">{inquiry.products}</dd>
                    </div>
                    <div className="def-row">
                      <dt className="def-label">Bio</dt>
                      <dd className="def-value">{certificationOf(inquiry)}</dd>
                    </div>
                    <div className="def-row">
                      <dt className="def-label">Contact</dt>
                      <dd className="def-value def-value-mono">
                        {inquiry.email}
                        <br />
                        {phone(inquiry.phone)}
                      </dd>
                    </div>
                  </dl>

                  {inquiry.message && (
                    <p className="admin-quote admin-quote-compact" style={{ marginTop: '16px' }}>
                      {inquiry.message}
                    </p>
                  )}

                  <div className="admin-item-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => openInquiry(inquiry)}>
                      {inquiry.status === 'PENDING' || inquiry.status === 'IN_PROGRESS'
                        ? 'Étudier la candidature'
                        : 'Voir le détail'}
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
        totalPages={pagination.totalPages}
        onPageChange={setPage}
      />

      {selected && (
        <AdminModal title="Demande de producteur" width="720px" onClose={() => setSelected(null)}>
          <div className="admin-facts">
            <div>
              <span className="admin-field-label">Exploitation</span>
              <div className="admin-fact-value">{selected.farmName}</div>
            </div>
            <div>
              <span className="admin-field-label">Interlocuteur</span>
              <div className="admin-fact-value">{selected.firstName} {selected.lastName}</div>
            </div>
            <div>
              <span className="admin-field-label">Localisation</span>
              <div className="admin-fact-value">{locationOf(selected)}</div>
            </div>
            <div>
              <span className="admin-field-label">Certification</span>
              <div className="admin-fact-value">{certificationOf(selected)}</div>
            </div>
            <div>
              <span className="admin-field-label">Production</span>
              <div className="admin-fact-value">{selected.products}</div>
            </div>
            <div>
              <span className="admin-field-label">Contact</span>
              <div className="admin-fact-value admin-fact-value-mono">
                {selected.email}
                <br />
                {phone(selected.phone)}
              </div>
            </div>
          </div>

          {selected.availability && (
            <div style={{ marginBottom: '24px' }}>
              <span className="admin-field-label">Disponibilités</span>
              <p className="admin-fact-value">{selected.availability}</p>
            </div>
          )}

          {selected.message && (
            <div style={{ marginBottom: '24px' }}>
              <span className="admin-field-label">Message</span>
              <p className="admin-quote">{selected.message}</p>
            </div>
          )}

          <div style={{ marginBottom: '26px' }}>
            <label htmlFor="admin-inquiry-notes" className="admin-field-label">Notes internes</label>
            <textarea
              id="admin-inquiry-notes"
              className="admin-textarea"
              rows={3}
              placeholder="Notes internes (visite prévue, remarques, conditions d'acceptation…)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="admin-modal-actions">
            {selected.status !== 'ACCEPTED' && (
              <button type="button" className="admin-btn-forest" onClick={handleAccept} disabled={busy}>
                Accepter la candidature
              </button>
            )}
            {selected.status === 'PENDING' && (
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => applyStatus('IN_PROGRESS', { successMessage: 'La candidature passe à l\'étude.' })}
                disabled={busy}
              >
                Mettre à l&apos;étude
              </button>
            )}
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => applyStatus(selected.status, { successMessage: 'Les notes internes ont été enregistrées.' })}
              disabled={busy}
            >
              Enregistrer les notes
            </button>
            {selected.status !== 'REJECTED' && (
              <span className="admin-modal-actions-end">
                <button type="button" className="admin-btn-danger" onClick={handleReject} disabled={busy}>
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
