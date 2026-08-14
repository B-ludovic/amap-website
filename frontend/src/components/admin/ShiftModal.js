'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { useModal } from '../../contexts/ModalContext';
import AdminModal from './AdminModal';
import logger from '../../lib/logger';

function pad(number) {
  return String(number).padStart(2, '0');
}

/* Le champ date parle en « AAAA-MM-JJ » local : on écrit la date à la main
   plutôt que par toISOString, qui bascule d'un jour en soirée parisienne. */
function toInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function ShiftModal({ shift, onClose }) {
  const { showError } = useModal();
  const isEdit = Boolean(shift);

  const [users, setUsers] = useState([]);
  const [crew, setCrew] = useState(
    shift?.volunteers?.map(volunteer => ({
      userId: volunteer.user.id,
      role: volunteer.role ?? null,
      status: volunteer.status
    })) ?? []
  );
  const [formData, setFormData] = useState({
    distributionDate: shift ? toInputValue(shift.distributionDate) : '',
    startTime: shift?.startTime ?? '18:15',
    endTime: shift?.endTime ?? '19:15',
    volunteersNeeded: shift?.volunteersNeeded ?? 2,
    notes: shift?.notes ?? ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.admin.users.getAll();
      const list = Array.isArray(response.data) ? response.data : (response.data?.users ?? []);
      setUsers([...list].sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')));
    } catch (error) {
      logger.error('Erreur chargement utilisateurs:', error);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(current => ({ ...current, [name]: value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: '' }));
  };

  const validate = () => {
    const found = {};
    const needed = Number(formData.volunteersNeeded);

    if (!formData.distributionDate) found.distributionDate = 'Date requise';
    if (!formData.startTime) found.startTime = 'Heure de début requise';
    if (!formData.endTime) found.endTime = 'Heure de fin requise';
    if (formData.startTime && formData.endTime && formData.endTime <= formData.startTime) {
      found.endTime = 'L\'heure de fin doit suivre celle de début';
    }
    if (!Number.isInteger(needed) || needed < 1 || needed > 10) {
      found.volunteersNeeded = 'Entre 1 et 10 bénévoles';
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    /* Les lignes vides — un menu ouvert puis abandonné — ne partent pas au
       serveur. Le rôle et l'état des inscriptions existantes sont renvoyés
       tels quels : le contrôleur ne touche qu'aux entrées ajoutées ou
       retirées. */
    const payload = {
      ...formData,
      volunteersNeeded: Number(formData.volunteersNeeded),
      notes: formData.notes.trim() || null,
      volunteers: crew.filter(member => member.userId)
    };

    setLoading(true);
    try {
      if (isEdit) {
        await api.shifts.update(shift.id, payload);
      } else {
        await api.shifts.create(payload);
      }
      onClose(true, isEdit ? 'La permanence a été modifiée.' : 'La permanence a été créée.');
    } catch (error) {
      showError('Erreur', error.message || 'Une erreur est survenue.');
      setLoading(false);
    }
  };

  const takenIds = new Set(crew.map(member => member.userId).filter(Boolean));

  return (
    <AdminModal
      title={isEdit ? 'Modifier la permanence' : 'Créer une permanence'}
      width="680px"
      onClose={() => onClose(false)}
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-form">
          <div className="admin-form-row" style={{ '--admin-form-cols': 3 }}>
            <div className="admin-form-field">
              <label htmlFor="sh-date" className="admin-field-label">Date de distribution *</label>
              <input
                id="sh-date"
                name="distributionDate"
                type="date"
                className="admin-input admin-input-mono"
                value={formData.distributionDate}
                onChange={handleChange}
              />
              {errors.distributionDate && <span className="admin-form-error">{errors.distributionDate}</span>}
            </div>
            <div className="admin-form-field">
              <label htmlFor="sh-start" className="admin-field-label">Début *</label>
              <input
                id="sh-start"
                name="startTime"
                type="time"
                className="admin-input admin-input-mono"
                value={formData.startTime}
                onChange={handleChange}
              />
              {errors.startTime && <span className="admin-form-error">{errors.startTime}</span>}
            </div>
            <div className="admin-form-field">
              <label htmlFor="sh-end" className="admin-field-label">Fin *</label>
              <input
                id="sh-end"
                name="endTime"
                type="time"
                className="admin-input admin-input-mono"
                value={formData.endTime}
                onChange={handleChange}
              />
              {errors.endTime && <span className="admin-form-error">{errors.endTime}</span>}
            </div>
          </div>

          <div className="admin-form-field" style={{ maxWidth: '220px' }}>
            <label htmlFor="sh-needed" className="admin-field-label">Bénévoles nécessaires *</label>
            <input
              id="sh-needed"
              name="volunteersNeeded"
              type="number"
              min="1"
              max="10"
              className="admin-input admin-input-mono"
              value={formData.volunteersNeeded}
              onChange={handleChange}
            />
            {errors.volunteersNeeded && <span className="admin-form-error">{errors.volunteersNeeded}</span>}
          </div>

          <div className="admin-form-field">
            <label htmlFor="sh-notes" className="admin-field-label">Consignes (optionnel)</label>
            <textarea
              id="sh-notes"
              name="notes"
              rows={3}
              className="admin-textarea"
              placeholder="Clés du local, matériel à sortir, particularité du jour…"
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          <div>
            <div className="admin-crew-head">
              <span className="admin-field-label">Équipe assignée</span>
              <button
                type="button"
                className="admin-btn-link"
                onClick={() => setCrew(current => [...current, { userId: '', role: null, status: 'CONFIRMED' }])}
              >
                Ajouter un bénévole
              </button>
            </div>

            {crew.length === 0 ? (
              <p className="admin-crew-empty">
                Personne d&apos;assigné — les adhérents peuvent s&apos;inscrire eux-mêmes.
              </p>
            ) : (
              <div className="admin-crew-editor">
                {crew.map((member, index) => (
                  <div key={index} className="admin-crew-row">
                    <select
                      className="admin-select-full"
                      value={member.userId}
                      aria-label={`Bénévole ${index + 1}`}
                      onChange={(event) => {
                        const userId = event.target.value;
                        setCrew(current => current.map((item, position) => (
                          position === index ? { ...item, userId } : item
                        )));
                      }}
                    >
                      <option value="">Choisir un membre…</option>
                      {users.map(user => (
                        <option
                          key={user.id}
                          value={user.id}
                          disabled={user.id !== member.userId && takenIds.has(user.id)}
                        >
                          {user.lastName} {user.firstName} — {user.email}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="admin-btn-link admin-btn-link-delete"
                      onClick={() => setCrew(current => current.filter((_, position) => position !== index))}
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-modal-actions">
          <button type="submit" className="admin-btn-primary" disabled={loading}>
            {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la permanence'}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => onClose(false)} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
