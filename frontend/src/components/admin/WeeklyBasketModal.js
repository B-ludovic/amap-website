'use client';

import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X, ShoppingBasket } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { inputDate } from '../../lib/format';

// Prochain jour de distribution fixe (mercredi = 3)
const DISTRIBUTION_DAY = 3;
const getNextDistributionDate = () => {
  const today = new Date();
  const daysUntil = (DISTRIBUTION_DAY - today.getDay() + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return inputDate(next);
};

// Calcul du numéro de semaine ISO (lundi = début de semaine)
const getISOWeekAndYear = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const dayOfWeek = (date.getDay() + 6) % 7;
  const thursday = new Date(year, month - 1, day - dayOfWeek + 3);

  const isoYear = thursday.getFullYear();
  const jan1 = new Date(isoYear, 0, 1);
  const jan1Dow = (jan1.getDay() + 6) % 7;
  const firstThursday = new Date(isoYear, 0, 1 + (3 - jan1Dow + 7) % 7);

  const weekNum = 1 + Math.round((thursday - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return { week: weekNum, year: isoYear };
};

export default function WeeklyBasketModal({ basket, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    weekNumber: '',
    year: new Date().getFullYear(),
    distributionDate: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (basket) {
      const formattedDate = inputDate(basket.distributionDate);

      setFormData({
        weekNumber: basket.weekNumber.toString(),
        year: basket.year,
        distributionDate: formattedDate,
        notes: basket.notes || '',
      });
    } else {
      const nextDate = getNextDistributionDate();
      const { week, year } = getISOWeekAndYear(nextDate);
      setFormData(prev => ({
        ...prev,
        distributionDate: nextDate,
        weekNumber: week.toString(),
        year,
      }));
    }
  }, [basket]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'distributionDate' && value) {
      const { week, year } = getISOWeekAndYear(value);
      setFormData(prev => ({
        ...prev,
        distributionDate: value,
        weekNumber: week.toString(),
        year,
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.weekNumber || formData.weekNumber < 1 || formData.weekNumber > 52) {
      newErrors.weekNumber = 'Semaine invalide (1-52)';
    }

    if (!formData.year) {
      newErrors.year = 'Année requise';
    }

    if (!formData.distributionDate) {
      newErrors.distributionDate = 'Date de distribution requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      const dataToSend = {
        weekNumber: parseInt(formData.weekNumber),
        year: parseInt(formData.year),
        distributionDate: formData.distributionDate,
        notes: formData.notes,
      };

      if (basket) {
        await api.weeklyBaskets.update(basket.id, dataToSend);
        showSuccess('Panier modifié avec succès');
      } else {
        await api.weeklyBaskets.create(dataToSend);
        showSuccess('Panier créé avec succès');
      }

      onClose(true);
    } catch (error) {
      showError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(false); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-large" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-basket" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title-basket">{basket ? 'Modifier le panier' : 'Créer un panier hebdomadaire'}</h2>
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
                className={errors.distributionDate ? 'input-error' : ''}
              />
              {formData.distributionDate && formData.weekNumber && (
                <span className="week-preview">
                  Semaine {formData.weekNumber} · {formData.year}
                </span>
              )}
              {errors.distributionDate && (
                <span className="error-message">{errors.distributionDate}</span>
              )}
            </div>


            <div className="form-group">
              <label htmlFor="notes">Le mot de la semaine (optionnel)</label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Le mot de la semaine, pour les adhérents…"
              />
            </div>
            {!basket && (
              <div className="empty-composition">
                <ShoppingBasket size={32} />
                <p>La composition sera générée depuis les produits actifs de la saison.</p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-btn-primary"
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : basket ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
