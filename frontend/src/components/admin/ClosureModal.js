'use client';

import { useState } from 'react';
import api from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';
import AdminModal from './AdminModal';
import { countClosureDays } from '../../lib/closures';
import { dayMonthYearLong, plural } from '../../lib/format';

function pad(number) {
  return String(number).padStart(2, '0');
}

/* Les champs date parlent en « AAAA-MM-JJ » local. On écrit la date à la main
   plutôt que par toISOString, qui bascule d'un jour en soirée parisienne. */
function toInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(inputValue, days) {
  const date = new Date(`${inputValue}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toInputValue(date);
}

export default function ClosureModal({ closure, daysUsed, maxDays, year, onClose }) {
  const { showConfirm } = useModal();
  const isEdit = Boolean(closure);

  const [startDate, setStartDate] = useState(
    closure ? toInputValue(closure.startDate) : toInputValue(new Date())
  );
  const [endDate, setEndDate] = useState(
    closure ? toInputValue(closure.endDate) : addDays(toInputValue(new Date()), 6)
  );
  const [reason, setReason] = useState(closure?.reason ?? '');
  const [notify, setNotify] = useState(!isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  /* Budget disponible pour cette fermeture-ci : le quota annuel moins ce qui
     est déjà engagé, mais la fermeture en cours de modification se rend son
     propre coût — sinon elle se compterait contre elle-même, exactement comme
     le fait le contrôleur avec son excludedId. */
  const ownDays = isEdit ? countClosureDays(closure.startDate, closure.endDate) : 0;
  const budget = Math.max(0, maxDays - daysUsed + ownDays);

  const daysRequested = countClosureDays(startDate, endDate);
  const isReversed = new Date(endDate) < new Date(startDate);
  const wouldExceed = daysRequested > budget;
  const daysLeftAfter = Math.max(0, budget - daysRequested);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = { startDate, endDate, reason: reason.trim() || undefined, notify };
      const response = isEdit
        ? await api.closures.update(closure.id, payload)
        : await api.closures.create(payload);

      onClose(true, response.message);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isReversed) {
      setError('La date de fin ne peut pas précéder la date de début.');
      return;
    }

    const period = `du ${dayMonthYearLong(startDate)} au ${dayMonthYearLong(endDate)}`;
    const mail = notify
      ? ' Une newsletter partira aux abonnés actifs.'
      : ' Aucune newsletter ne sera envoyée.';

    showConfirm(
      isEdit ? 'Modifier la fermeture' : 'Confirmer la fermeture',
      isEdit
        ? `Enregistrer la fermeture ${period} ?${mail}`
        : `Fermer l'AMAP ${period} ? Aucune distribution n'aura lieu pendant cette période.${mail}`,
      submit
    );
  };

  return (
    <AdminModal
      title={isEdit ? 'Modifier la fermeture' : 'Créer une fermeture'}
      width="640px"
      onClose={() => onClose(false)}
      isDirty={isDirty}
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-form admin-closure-form">
          <div className="admin-form-row">
            <div className="admin-form-field">
              <label htmlFor="cl-start" className="admin-field-label">Date de début *</label>
              <input
                id="cl-start"
                type="date"
                className="admin-input admin-input-mono"
                value={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  if (new Date(endDate) < new Date(value)) setEndDate(value);
                  setIsDirty(true);
                }}
              />
            </div>
            <div className="admin-form-field">
              <label htmlFor="cl-end" className="admin-field-label">Date de fin *</label>
              <input
                id="cl-end"
                type="date"
                className="admin-input admin-input-mono"
                value={endDate}
                min={startDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* Coût de la période, recalculé à chaque frappe. Les deux bornes sont
              comprises : du 24 au 31, l'AMAP est fermée huit jours. */}
          {wouldExceed ? (
            <div className="form-alert admin-closure-cost">
              <span className="form-alert-dot" />
              <span className="form-alert-text">
                Cette période consomme <span className="admin-closure-cost-strong">{daysRequested} {plural(daysRequested, 'jour', 'jours')}</span>,
                il n&apos;en reste que {budget} sur le quota {year}.
              </span>
            </div>
          ) : (
            <div className="notice-band admin-closure-cost">
              <span className="notice-band-dot" />
              <span className="notice-band-text">
                Cette fermeture consomme <span className="admin-closure-cost-strong">{daysRequested} {plural(daysRequested, 'jour', 'jours')}</span> sur le quota annuel.
              </span>
              <span className="admin-closure-cost-right">reste {daysLeftAfter} j</span>
            </div>
          )}

          <div className="admin-form-field">
            <label htmlFor="cl-reason" className="admin-field-label">Motif (optionnel)</label>
            <input
              id="cl-reason"
              type="text"
              className="admin-input"
              placeholder="Ex : congés estivaux, travaux…"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setIsDirty(true);
              }}
            />
          </div>

          <label className="admin-check" htmlFor="cl-notify">
            <input
              id="cl-notify"
              type="checkbox"
              checked={notify}
              onChange={(event) => {
                setNotify(event.target.checked);
                setIsDirty(true);
              }}
            />
            <span>
              {isEdit
                ? 'Prévenir les adhérents du changement par newsletter'
                : 'Prévenir les adhérents par newsletter automatique'}
            </span>
          </label>

          {error && (
            <div className="form-alert">
              <span className="form-alert-dot" />
              <span className="form-alert-text">{error}</span>
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="submit" className="admin-btn-primary" disabled={loading || wouldExceed || isReversed}>
            {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la fermeture'}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => onClose(false)} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
