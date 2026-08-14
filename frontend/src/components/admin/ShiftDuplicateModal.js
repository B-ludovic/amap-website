'use client';

import { useState } from 'react';
import api from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';
import AdminModal from './AdminModal';
import { longDate } from '../../lib/format';

/* Duplication d'une permanence : le serveur recopie les horaires, l'effectif
   attendu et les consignes, mais pas l'équipe — les bénévoles d'une semaine ne
   sont pas ceux de la suivante. Cette modale remplace le prompt() du
   navigateur, qui n'offrait ni validation ni contexte. */
export default function ShiftDuplicateModal({ shift, onClose }) {
  const { showError } = useModal();
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!newDate) {
      setError('Choisissez la date de la nouvelle permanence.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.shifts.duplicate(shift.id, { newDate });
      onClose(true, 'La permanence a été dupliquée.');
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  return (
    <AdminModal title="Dupliquer la permanence" width="520px" onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit}>
        <div className="admin-form">
          <p className="admin-quote admin-quote-compact">
            Modèle : {longDate(shift.distributionDate)}, {shift.startTime} – {shift.endTime},
            {' '}{shift.volunteersNeeded} bénévoles attendus. Les consignes sont recopiées,
            l&apos;équipe ne l&apos;est pas.
          </p>

          <div className="admin-form-field">
            <label htmlFor="sd-date" className="admin-field-label">Nouvelle date *</label>
            <input
              id="sd-date"
              type="date"
              className="admin-input admin-input-mono"
              value={newDate}
              onChange={(event) => setNewDate(event.target.value)}
            />
          </div>

          {error && (
            <div className="form-alert">
              <span className="form-alert-dot" />
              <span className="form-alert-text">{error}</span>
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button type="submit" className="admin-btn-primary" disabled={loading}>
            {loading ? 'Duplication…' : 'Dupliquer'}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => onClose(false)} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
