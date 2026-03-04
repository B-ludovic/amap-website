'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingBasket, RefreshCw } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

// Prochain jour de distribution fixe (mercredi = 3)
const DISTRIBUTION_DAY = 3;
const getNextDistributionDate = () => {
  const today = new Date();
  const daysUntil = (DISTRIBUTION_DAY - today.getDay() + 7) % 7 || 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysUntil);
  return next.toISOString().split('T')[0];
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

export default function WeeklyBasketModal({ basket, lastBasket, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    weekNumber: '',
    year: new Date().getFullYear(),
    distributionDate: '',
    notes: '',
  });
  // Chaque item : { type: 'catalogue' | 'libre', productId: '', customProductName: '' }
  const [composition, setComposition] = useState([]);
  const [errors, setErrors] = useState({});
  const [reconduireApplied, setReconduireApplied] = useState(false);

  useEffect(() => {
    fetchProducts();
    if (basket) {
      const date = new Date(basket.distributionDate);
      const formattedDate = date.toISOString().split('T')[0];

      setFormData({
        weekNumber: basket.weekNumber.toString(),
        year: basket.year,
        distributionDate: formattedDate,
        notes: basket.notes || '',
      });

      if (basket.items && basket.items.length > 0) {
        setComposition(
          basket.items.map(item => ({
            type: item.productId ? 'catalogue' : 'libre',
            productId: item.productId || '',
            customProductName: item.customProductName || '',
          }))
        );
      }
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

  const fetchProducts = async () => {
    try {
      const response = await api.admin.products.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error('Erreur produits:', error);
    }
  };

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

  const handleReconduire = () => {
    if (!lastBasket) return;
    setComposition(
      lastBasket.items.map(item => ({
        type: item.productId ? 'catalogue' : 'libre',
        productId: item.productId || '',
        customProductName: item.customProductName || '',
      }))
    );
    if (lastBasket.notes) {
      setFormData(prev => ({ ...prev, notes: lastBasket.notes }));
    }
    setReconduireApplied(true);
  };

  const handleAddProduct = () => {
    setComposition(prev => [
      ...prev,
      { type: 'catalogue', productId: '', customProductName: '' }
    ]);
  };

  const handleRemoveProduct = (index) => {
    setComposition(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setComposition(prev => {
      const next = [...prev];
      if (field === 'type') {
        // Réinitialiser les champs de l'autre mode
        next[index] = { type: value, productId: '', customProductName: '' };
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
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

    if (composition.length === 0) {
      newErrors.composition = 'Ajoutez au moins un produit';
    }

    const hasInvalid = composition.some(item =>
      (item.type === 'catalogue' && !item.productId) ||
      (item.type === 'libre' && !item.customProductName.trim())
    );

    if (hasInvalid) {
      newErrors.composition = 'Tous les produits doivent être renseignés';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      const items = composition.map(item =>
        item.type === 'catalogue'
          ? { productId: item.productId }
          : { customProductName: item.customProductName.trim() }
      );

      const dataToSend = {
        weekNumber: parseInt(formData.weekNumber),
        year: parseInt(formData.year),
        distributionDate: formData.distributionDate,
        notes: formData.notes,
        items
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

  const formatShortDate = (dateStr) => new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{basket ? 'Modifier le panier' : 'Créer un panier hebdomadaire'}</h2>
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

            {/* Bouton Reconduire — uniquement en création */}
            {!basket && lastBasket && (
              <div className={`reconduire-banner${reconduireApplied ? ' reconduire-applied' : ''}`}>
                <div className="reconduire-info">
                  <RefreshCw size={18} />
                  <div>
                    <span className="reconduire-title">
                      Semaine {lastBasket.weekNumber} · {lastBasket.year}
                    </span>
                    <span className="reconduire-subtitle">
                      {lastBasket.items.length} produit{lastBasket.items.length > 1 ? 's' : ''} · {formatShortDate(lastBasket.distributionDate)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn-sm${reconduireApplied ? ' btn-success' : ' btn-secondary'}`}
                  onClick={handleReconduire}
                >
                  {reconduireApplied ? '✓ Composition reprise' : 'Reconduire ce panier'}
                </button>
              </div>
            )}

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
              <label htmlFor="notes">Notes (optionnel)</label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Message de la semaine pour les adhérents..."
              />
            </div>

            {/* Composition */}
            <div className="form-group">
              <div className="basket-composition-header">
                <label>
                  Composition du panier <span className="required">*</span>
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddProduct}
                >
                  <Plus size={16} />
                  Ajouter un produit
                </button>
              </div>

              {errors.composition && (
                <span className="error-message">{errors.composition}</span>
              )}

              {composition.length === 0 ? (
                <div className="empty-composition">
                  <ShoppingBasket size={32} />
                  <p>Aucun produit ajouté</p>
                </div>
              ) : (
                <div className="basket-composition-list">
                  {composition.map((item, index) => (
                    <div key={index} className="basket-composition-item">

                      {/* Toggle catalogue / libre */}
                      <div className="basket-item-type-toggle">
                        <button
                          type="button"
                          className={`toggle-btn${item.type === 'catalogue' ? ' active' : ''}`}
                          onClick={() => handleItemChange(index, 'type', 'catalogue')}
                        >
                          Catalogue
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn${item.type === 'libre' ? ' active' : ''}`}
                          onClick={() => handleItemChange(index, 'type', 'libre')}
                        >
                          Libre
                        </button>
                      </div>

                      {/* Champ selon le mode */}
                      <div className="basket-item-field">
                        {item.type === 'catalogue' ? (
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                          >
                            <option value="">Sélectionner un produit</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.producer.name})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={item.customProductName}
                            onChange={(e) => handleItemChange(index, 'customProductName', e.target.value)}
                            placeholder="Nom du produit libre..."
                          />
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn-remove-product"
                        onClick={() => handleRemoveProduct(index)}
                        aria-label="Supprimer ce produit"
                      >
                        <Trash2 size={18} />
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
              {loading ? 'Enregistrement...' : basket ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
