'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import ShiftModal from '../../../components/admin/ShiftModal';
import ShiftDuplicateModal from '../../../components/admin/ShiftDuplicateModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { longDate, plural } from '../../../lib/format';
import '../../../styles/admin/shifts-da.css';

const FILTERS = [
  { key: 'upcoming', label: 'À venir', params: { upcoming: 'true' } },
  { key: 'past', label: 'Passées', params: { past: 'true' } },
  { key: 'all', label: 'Toutes', params: {} }
];

/* La liste sert aussi de registre : un désistement ou une absence reste
   visible, il ne compte simplement plus dans l'effectif. */
const CREW_STATES = {
  CONFIRMED: { label: null, off: false },
  CANCELLED: { label: 'désisté', off: true },
  ABSENT: { label: 'absent', off: true }
};

function capitalize(text) {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function isPast(shift) {
  return new Date(shift.distributionDate) < new Date();
}

export default function AdminPermanencesPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [shifts, setShifts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const [duplicating, setDuplicating] = useState(null);

  const fetchShifts = useCallback(async (key, wanted) => {
    setLoading(true);
    try {
      const definition = FILTERS.find(item => item.key === key) ?? FILTERS[0];
      const response = await api.shifts.getAll({ page: wanted, ...definition.params });

      setShifts(response.data.shifts);
      setPagination(response.data.pagination);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les permanences.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchShifts(filter, page);
  }, [filter, page, fetchShifts]);

  /* Changer de filtre remet à la première page : rester en page 3 après un
     passage de « Passées » à « À venir » affiche un écran vide alors que la
     liste, elle, n'est pas vide. */
  const changeFilter = (key) => {
    setFilter(key);
    setPage(1);
  };

  const closeModal = (shouldRefresh, message) => {
    setEditing(null);
    setDuplicating(null);
    if (shouldRefresh) {
      showSuccess('Permanence enregistrée', message ?? 'La permanence a été enregistrée.');
      fetchShifts(filter, page);
    }
  };

  const handleDelete = (shift) => {
    const crew = shift.volunteers.filter(volunteer => volunteer.status === 'CONFIRMED').length;

    showConfirm(
      'Supprimer la permanence',
      crew > 0
        ? `Supprimer la permanence du ${longDate(shift.distributionDate)} ? Un email d'annulation partira aux ${crew} ${plural(crew, 'bénévole inscrit', 'bénévoles inscrits')}.`
        : `Supprimer la permanence du ${longDate(shift.distributionDate)} ? Personne n'y est inscrit.`,
      async () => {
        try {
          await api.shifts.delete(shift.id);
          showSuccess('Permanence supprimée', 'La permanence a été retirée du calendrier.');
          fetchShifts(filter, page);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  /* Pointage après coup : seule une permanence passée se pointe, et le geste
     est réversible — le serveur accepte les trois états. */
  const markCrew = async (shift, volunteer, status) => {
    try {
      await api.shifts.setVolunteerStatus(shift.id, volunteer.user.id, { status });
      fetchShifts(filter, page);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  /* Le bandeau d'alerte ne s'affiche que sur le filtre « À venir » : ailleurs,
     compter les permanences incomplètes n'a pas de sens. Il compte ce qui est
     à l'écran, donc la page courante — d'où le « sur cette page » quand la
     liste déborde, pour ne pas faire passer un décompte partiel pour un total. */
  const understaffed = filter === 'upcoming' ? shifts.filter(shift => !shift.isFull).length : 0;
  const partial = pagination.totalPages > 1;

  return (
    <div className="admin-shifts">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Permanences</h1>
          <p className="admin-title-lead">
            Les bénévoles de chaque distribution — inscription libre des adhérents, complétée à la main si besoin.
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => setEditing({ id: null })}>
          Créer une permanence
        </button>
      </div>

      {understaffed > 0 && (
        <div className="notice-band admin-shifts-band">
          <span className="notice-band-dot" />
          <span className="notice-band-text">
            {understaffed} {plural(understaffed, 'permanence à venir cherche', 'permanences à venir cherchent')} encore des bénévoles{partial ? ' sur cette page' : ''}.
          </span>
        </div>
      )}

      <div className="admin-shifts-toolbar">
        <div className="admin-pills">
          {FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              className={`admin-pill ${filter === item.key ? 'admin-pill-active' : ''}`}
              onClick={() => changeFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="admin-toolbar-count">
          {shifts.length < pagination.total
            ? `${shifts.length} affichées sur ${pagination.total}`
            : `${pagination.total} ${plural(pagination.total, 'permanence', 'permanences')}`}
        </span>
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : shifts.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucune permanence</p>
          <p className="admin-empty-card-note">Rien à afficher avec ce filtre.</p>
        </div>
      ) : (
        <div className="admin-shifts-list">
          {shifts.map((shift) => {
            const past = isPast(shift);
            const countTone = past
              ? 'admin-shift-count-past'
              : shift.isFull
                ? 'admin-shift-count-full'
                : shift.confirmedCount === 0
                  ? 'admin-shift-count-empty'
                  : '';

            return (
              <article key={shift.id} className="admin-row-card admin-shift">
                <div className={`admin-shift-count ${countTone}`}>
                  {shift.confirmedCount}/{shift.volunteersNeeded}
                </div>

                <div>
                  <div className="admin-shift-date">{capitalize(longDate(shift.distributionDate))}</div>

                  <div className="admin-shift-meta">
                    {past ? (
                      <span className="admin-badge">Passée</span>
                    ) : shift.isFull ? (
                      <span className="admin-badge admin-badge-green">Complète</span>
                    ) : shift.confirmedCount === 0 ? (
                      <span className="admin-badge admin-badge-red">Aucun bénévole</span>
                    ) : (
                      <span className="admin-badge admin-badge-amber">Places libres</span>
                    )}
                    <span className="admin-shift-hours">{shift.startTime} – {shift.endTime}</span>
                  </div>

                  {shift.volunteers.length > 0 && (
                    <div className="admin-shift-crew">
                      {shift.volunteers.map((volunteer) => {
                        const state = CREW_STATES[volunteer.status] ?? { label: volunteer.status, off: true };

                        return (
                          <span
                            key={volunteer.id}
                            className={`admin-crew-chip ${state.off ? 'admin-crew-chip-off' : ''}`}
                          >
                            {volunteer.user.firstName} {volunteer.user.lastName}
                            {volunteer.role && <span className="admin-crew-role">{volunteer.role}</span>}
                            {state.label && <span className="admin-crew-role">{state.label}</span>}
                            {past && volunteer.status === 'CONFIRMED' && (
                              <button
                                type="button"
                                className="admin-crew-mark"
                                onClick={() => markCrew(shift, volunteer, 'ABSENT')}
                              >
                                absent
                              </button>
                            )}
                            {past && volunteer.status === 'ABSENT' && (
                              <button
                                type="button"
                                className="admin-crew-mark"
                                onClick={() => markCrew(shift, volunteer, 'CONFIRMED')}
                              >
                                présent
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {shift.notes && (
                    <p className="admin-quote admin-quote-compact admin-shift-notes">{shift.notes}</p>
                  )}
                </div>

                <div className="admin-shift-actions">
                  <button type="button" className="admin-btn-link" onClick={() => setEditing(shift)}>
                    Modifier
                  </button>
                  <button type="button" className="admin-btn-link admin-btn-link-muted" onClick={() => setDuplicating(shift)}>
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    className="admin-btn-link admin-btn-link-delete"
                    onClick={() => handleDelete(shift)}
                  >
                    Supprimer
                  </button>
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

      {editing && (
        <ShiftModal shift={editing.id ? editing : null} onClose={closeModal} />
      )}

      {duplicating && (
        <ShiftDuplicateModal shift={duplicating} onClose={closeModal} />
      )}
    </div>
  );
}
