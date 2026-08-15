'use client';

import { useState } from 'react';
import api from '../../lib/api';
import AdminModal from './AdminModal';

/* Note de retrait : « récupéré par son voisin », « panier mis de côté ».
   Cette modale remplace le prompt() du navigateur, qui s'ouvrait toujours vide
   — donc sans moyen de corriger une note existante — et refusait la chaîne
   vide, donc sans moyen d'en effacer une. */
export default function PickupNoteModal({ item, weeklyBasketId, onClose }) {
  const [note, setNote] = useState(item.pickup?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Rien à écrire et rien à effacer : inutile de créer une ligne de retrait.
    if (!item.pickup && !note.trim()) {
      onClose(null);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = item.pickup
        ? await api.distribution.markAsPickedUp(item.pickup.id, {
            wasPickedUp: item.pickup.wasPickedUp,
            notes: note,
            weeklyBasketId,
          })
        : await api.distribution.markAsPickedUp('new', {
            subscriptionId: item.subscriptionId,
            weeklyBasketId,
            wasPickedUp: false,
            notes: note,
          });

      onClose(response.data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AdminModal title="Note de retrait" width="520px" onClose={() => onClose(null)} isDirty={isDirty}>
      <form onSubmit={handleSubmit}>
        <div className="admin-form">
          <p className="admin-quote admin-quote-compact">
            {item.user.firstName} {item.user.lastName} — #{item.subscriptionNumber}
          </p>

          <div className="admin-form-field">
            <label htmlFor="pickup-note" className="admin-field-label">Note</label>
            <input
              id="pickup-note"
              type="text"
              className="admin-input"
              placeholder="Ex. : récupéré par son voisin"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setIsDirty(true);
              }}
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
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => onClose(null)} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
