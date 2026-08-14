'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import ClosureModal from '../../../components/admin/ClosureModal';
import { countClosureDays, closureState } from '../../../lib/closures';
import { dayMonthYearLong, plural } from '../../../lib/format';
import '../../../styles/admin/closures-da.css';

const STATES = {
  ONGOING: { label: 'En cours', tone: 'admin-badge-red' },
  UPCOMING: { label: 'À venir', tone: 'admin-badge-amber' },
  PAST: { label: 'Passée', tone: '' }
};

/* Les fermetures à venir et celle en cours passent devant, dans l'ordre du
   calendrier ; les passées suivent, de la plus récente à la plus ancienne.
   L'API les rend triées par date croissante, ce qui enterrerait les prochaines
   sous celles de janvier. */
function orderForAdmin(closures) {
  const upcoming = [];
  const past = [];

  for (const closure of closures) {
    (closureState(closure) === 'PAST' ? past : upcoming).push(closure);
  }

  upcoming.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  past.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  return [...upcoming, ...past];
}

export default function AdminFermeturesPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [closures, setClosures] = useState([]);
  const [quota, setQuota] = useState({ year: new Date().getFullYear(), maxDays: 21, used: 0, remaining: 21 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetchClosures = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.closures.getAll();
      const data = response.data;

      setClosures(orderForAdmin(data.closures));
      setQuota({
        year: data.year,
        maxDays: data.maxDaysPerYear,
        used: data.daysUsedThisYear,
        remaining: data.daysRemainingThisYear
      });
    } catch (error) {
      showError('Erreur', 'Impossible de charger les fermetures.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  const closeModal = (shouldRefresh, message) => {
    setEditing(null);
    if (shouldRefresh) {
      showSuccess('Fermeture enregistrée', message ?? 'La période a été enregistrée.');
      fetchClosures();
    }
  };

  const handleDelete = (closure) => {
    showConfirm(
      'Supprimer la fermeture',
      `Supprimer la fermeture du ${dayMonthYearLong(closure.startDate)} au ${dayMonthYearLong(closure.endDate)} ? Les adhérents déjà prévenus ne recevront pas de démenti.`,
      async () => {
        try {
          await api.closures.delete(closure.id);
          showSuccess('Fermeture supprimée', 'La période a été retirée du calendrier.');
          fetchClosures();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const isExhausted = quota.remaining === 0;
  const filled = Math.min(100, Math.round((quota.used / quota.maxDays) * 1000) / 10);

  return (
    <div className="admin-closures">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Fermetures AMAP</h1>
          <p className="admin-title-lead">
            Semaines sans distribution — les adhérents sont prévenus par newsletter.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn-primary"
          onClick={() => setEditing({ id: null })}
          disabled={isExhausted}
        >
          Créer une fermeture
        </button>
      </div>

      {/* Jauge de quota : ce qui est engagé sur l'année civile en cours. */}
      <div className="admin-quota">
        <div className="admin-quota-head">
          <span className="admin-quota-label">
            Quota {quota.year} — <span className="admin-quota-count">{quota.used} / {quota.maxDays} jours</span>
          </span>
          <span className={`admin-quota-left ${isExhausted ? 'admin-quota-left-empty' : ''}`}>
            {isExhausted
              ? 'quota atteint'
              : `${quota.remaining} ${plural(quota.remaining, 'jour restant', 'jours restants')}`}
          </span>
        </div>
        <div className="admin-quota-track">
          <div
            className={`admin-quota-fill ${isExhausted ? 'admin-quota-fill-full' : ''}`}
            style={{ width: `${filled}%` }}
          />
        </div>
        <p className="admin-quota-note">
          Trois semaines de fermeture collective au maximum par année civile, soit {quota.maxDays} jours.
        </p>
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : closures.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucune fermeture</p>
          <p className="admin-empty-card-note">Le calendrier de distribution est complet.</p>
        </div>
      ) : (
        <div className="admin-closures-list">
          {closures.map((closure) => {
            const state = closureState(closure);
            const badge = STATES[state];
            const days = countClosureDays(closure.startDate, closure.endDate);

            return (
              <article key={closure.id} className="admin-row-card admin-closure">
                <div className="admin-closure-days">{days} j</div>

                <div>
                  <div className="admin-closure-range">
                    {dayMonthYearLong(closure.startDate)} → {dayMonthYearLong(closure.endDate)}
                  </div>
                  <div className="admin-closure-meta">
                    <span className={`admin-badge ${badge.tone}`}>{badge.label}</span>
                    {closure.reason && <span className="admin-closure-reason">{closure.reason}</span>}
                  </div>
                </div>

                {/* Une fermeture commencée ne se corrige plus : les adhérents ont
                    déjà organisé leur semaine autour. Le serveur refuse, l'écran
                    ne propose donc pas. */}
                {state === 'UPCOMING' ? (
                  <div className="admin-closure-actions">
                    <button type="button" className="admin-btn-link" onClick={() => setEditing(closure)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="admin-btn-link admin-btn-link-delete"
                      onClick={() => handleDelete(closure)}
                    >
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <span className="admin-closure-locked">Non modifiable</span>
                )}
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <ClosureModal
          closure={editing.id ? editing : null}
          daysUsed={quota.used}
          maxDays={quota.maxDays}
          year={quota.year}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
