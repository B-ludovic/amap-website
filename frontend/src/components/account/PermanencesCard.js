'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { longDate, longDayMonth, plural, toDate } from '../../lib/format';

const UPCOMING_LIMIT = 6;
const WITHDRAWAL_DELAY_MS = 48 * 60 * 60 * 1000;

const MY_STATE = {
  PENDING: 'En attente de validation',
  CONFIRMED: 'Inscription confirmée',
  REFUSED: 'Proposition non retenue',
};

const hourLabel = (value) => (value || '').replace(':', 'h');

/* Les prochaines distributions, et pour chacune ce que l'adhérent peut faire :
   se proposer, retirer sa proposition ou se désister. Un admin confirme ou refuse. */
export default function PermanencesCard({ userId, contractStart, contractEnd, onChange }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const loadShifts = useCallback(async () => {
    try {
      const response = await api.shifts.getAll({ upcoming: 'true', limit: UPCOMING_LIMIT });
      setShifts(response.data.shifts);
    } catch {
      setFeedback('Le planning n’a pas pu être chargé. Réessayez dans un instant.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const act = async (shift, request, success) => {
    setBusyId(shift.id);
    setFeedback('');
    try {
      await request(shift.id);
      setFeedback(success);
      await loadShifts();
      onChange?.();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const actionFor = (shift, mine, covered) => {
    const day = longDate(shift.distributionDate);

    if (mine?.status === 'PENDING') {
      return {
        label: 'Retirer ma proposition',
        quiet: true,
        run: () => act(shift, api.shifts.leave, `Proposition retirée pour le ${day}.`),
      };
    }

    if (mine?.status === 'CONFIRMED') {
      const farEnough = toDate(shift.distributionDate) - Date.now() > WITHDRAWAL_DELAY_MS;
      return farEnough && {
        label: 'Me désister',
        quiet: true,
        run: () => act(shift, api.shifts.leave, `Désistement enregistré pour le ${day}.`),
      };
    }

    if (mine?.status === 'REFUSED' || !covered || shift.isFull) return null;

    return {
      label: 'Me proposer',
      run: () => act(
        shift,
        api.shifts.propose,
        `Proposition envoyée pour le ${day}. L’équipe vous répondra par email.`
      ),
    };
  };

  const start = toDate(contractStart);
  const end = toDate(contractEnd);

  return (
    <article className="account-card">
      <div className="account-card-head">
        <h2 className="account-card-title">Permanences</h2>
        <span className="account-card-note">Validées par l’équipe</span>
      </div>

      <div className="account-shifts-body">
        <p className="account-shifts-intro">
          Proposez-vous pour tenir une distribution : l’équipe valide les inscriptions et vous
          répond par email.
        </p>

        {loading ? (
          <p className="account-loading">Chargement du planning…</p>
        ) : shifts.length === 0 ? (
          <p className="account-shifts-intro">Aucune distribution n’est encore planifiée.</p>
        ) : (
          <ul className="account-shifts-list">
            {shifts.map((shift) => {
              const date = toDate(shift.distributionDate);
              const mine = shift.volunteers.find((volunteer) => volunteer.userId === userId);
              const covered = Boolean(start && end && date >= start && date <= end);
              const places = Math.max(shift.volunteersNeeded - shift.confirmedCount, 0);
              const action = actionFor(shift, mine, covered);

              const state = MY_STATE[mine?.status]
                ?? (!covered ? 'Hors de votre contrat'
                  : shift.isFull ? 'Complet'
                    : `${places} ${plural(places, 'place libre', 'places libres')}`);

              return (
                <li key={shift.id} className="account-shift">
                  <div>
                    <div className="account-shift-date">{longDayMonth(shift.distributionDate)}</div>
                    <div className="account-shift-meta">
                      {hourLabel(shift.startTime)} → {hourLabel(shift.endTime)} · {state}
                    </div>
                  </div>

                  {action && (
                    <button
                      type="button"
                      className={`btn ${action.quiet ? 'btn-secondary' : 'btn-primary'} account-shift-btn`}
                      onClick={action.run}
                      disabled={busyId !== null}
                    >
                      {busyId === shift.id ? 'Envoi…' : action.label}
                      <span className="sr-only"> — {longDate(shift.distributionDate)}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="account-shifts-feedback" role="status">{feedback}</p>
      </div>
    </article>
  );
}
