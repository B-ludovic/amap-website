'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2 } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

export default function ShiftModal({ shift, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState([]);
  const [formData, setFormData] = useState({
    distributionDate: '',
    startTime: '18:15',
    endTime: '19:15',
    volunteersNeeded: 2,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchUsers();
    
    if (shift) {
      // Formater la date pour l'input date (YYYY-MM-DD)
      const date = new Date(shift.distributionDate);
      const formattedDate = date.toISOString().split('T')[0];
      
      setFormData({
        distributionDate: formattedDate,
        startTime: shift.startTime || '18:15',
        endTime: shift.endTime || '19:15',
        volunteersNeeded: shift.volunteersNeeded || 2,
        notes: shift.notes || '',
      });

      // Charger les bénévoles assignés
      if (shift.volunteers && shift.volunteers.length > 0) {
        setSelectedVolunteers(shift.volunteers.map(v => ({
          userId: v.user.id,
          userName: `${v.user.firstName} ${v.user.lastName}`,
          status: v.status
        })));
      }
    }
  }, [shift]);

  const fetchUsers = async () => {
    try {
      const response = await api.admin.users.getAll();
      // S'assurer que users est un tableau
      const usersData = Array.isArray(response.data) ? response.data : (response.data?.users || []);
      setUsers(usersData);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      setUsers([]);
    }
  };

  const handleAddVolunteer = () => {
    setSelectedVolunteers(prev => [...prev, { userId: '', userName: '', status: 'CONFIRMED' }]);
  };

  const handleVolunteerChange = (index, userId) => {
    const user = users.find(u => u.id === userId);
    setSelectedVolunteers(prev => {
      const updated = [...prev];
      updated[index] = {
        userId,
        userName: user ? `${user.firstName} ${user.lastName}` : '',
        status: 'CONFIRMED'
      };
      return updated;
    });
  };

  const handleRemoveVolunteer = (index) => {
    setSelectedVolunteers(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.distributionDate) {
      newErrors.distributionDate = 'La date est requise';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'L\'heure de début est requise';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'L\'heure de fin est requise';
    }

    if (formData.volunteersNeeded < 1 || formData.volunteersNeeded > 10) {
      newErrors.volunteersNeeded = 'Le nombre de bénévoles doit être entre 1 et 10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const dataToSend = {
        ...formData,
        volunteersNeeded: parseInt(formData.volunteersNeeded),
        volunteers: selectedVolunteers
          .filter(v => v.userId)
          .map(v => ({
            userId: v.userId,
            status: v.status
          }))
      };

      if (shift) {
        await api.shifts.update(shift.id, dataToSend);
        showSuccess('Permanence modifiée avec succès');
      } else {
        await api.shifts.create(dataToSend);
        showSuccess('Permanence créée avec succès');
      }

      onClose(true);
    } catch (error) {
      showError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{shift ? 'Modifier la permanence' : 'Créer une permanence'}</h2>
          <button
            className="modal-close"
            onClick={() => onClose(false)}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Date de distribution */}
            <div className="form-group">
              <label htmlFor="distributionDate">
                Date de distribution <span className="required">*</span>
              </label>
              <input
                type="date"
                id="distributionDate"
                name="distributionDate"
                value={formData.distributionDate}
                onChange={handleChange}
                className={errors.distributionDate ? 'error' : ''}
              />
              {errors.distributionDate && (
                <span className="error-message">{errors.distributionDate}</span>
              )}
            </div>

            {/* Horaires */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime">
                  Heure de début <span className="required">*</span>
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className={errors.startTime ? 'error' : ''}
                />
                {errors.startTime && (
                  <span className="error-message">{errors.startTime}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="endTime">
                  Heure de fin <span className="required">*</span>
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className={errors.endTime ? 'error' : ''}
                />
                {errors.endTime && (
                  <span className="error-message">{errors.endTime}</span>
                )}
              </div>
            </div>

            {/* Nombre de bénévoles */}
            <div className="form-group">
              <label htmlFor="volunteersNeeded">
                Nombre de bénévoles nécessaires <span className="required">*</span>
              </label>
              <input
                type="number"
                id="volunteersNeeded"
                name="volunteersNeeded"
                min="1"
                max="10"
                value={formData.volunteersNeeded}
                onChange={handleChange}
                className={errors.volunteersNeeded ? 'error' : ''}
              />
              {errors.volunteersNeeded && (
                <span className="error-message">{errors.volunteersNeeded}</span>
              )}
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">Notes (optionnel)</label>
              <textarea
                id="notes"
                name="notes"
                rows="4"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Instructions particulières, consignes..."
              />
            </div>

            {/* Bénévoles assignés */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                <label>Bénévoles assignés</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddVolunteer}
                >
                  <UserPlus size={16} />
                  Ajouter un bénévole
                </button>
              </div>

              {selectedVolunteers.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--spacing-lg)', 
                  background: 'var(--background-color)', 
                  borderRadius: 'var(--border-radius-sm)',
                  color: 'var(--text-secondary)'
                }}>
                  <p>Aucun bénévole assigné</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  {selectedVolunteers.map((volunteer, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      gap: 'var(--spacing-sm)', 
                      alignItems: 'center',
                      padding: 'var(--spacing-sm)',
                      background: 'var(--background-color)',
                      borderRadius: 'var(--border-radius-sm)'
                    }}>
                      <select
                        value={volunteer.userId}
                        onChange={(e) => handleVolunteerChange(index, e.target.value)}
                        style={{ flex: 1 }}
                        required
                      >
                        <option value="">Sélectionner un membre</option>
                        {users.map(user => (
                          <option 
                            key={user.id} 
                            value={user.id}
                            disabled={selectedVolunteers.some((v, i) => i !== index && v.userId === user.id)}
                          >
                            {user.firstName} {user.lastName} ({user.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => handleRemoveVolunteer(index)}
                        title="Retirer"
                      >
                        <Trash2 size={18} color="var(--error-color-dark)" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : shift ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
