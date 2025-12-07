'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingBasket } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

export default function WeeklyBasketModal({ basket, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    weekNumber: '',
    year: new Date().getFullYear(),
    distributionDate: '',
    notes: '',
  });
  const [composition, setComposition] = useState([]);
  const [errors, setErrors] = useState({});

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
            productId: item.product?.id || item.productId,
            quantitySmall: item.quantitySmall,
            quantityLarge: item.quantityLarge,
            product: item.product
          }))
        );
      }
    }
  }, [basket]);

  const fetchProducts = async () => {
    try {
      const response = await api.admin.products.getAll();
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Erreur produits:', error);
    }
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

  const handleAddProduct = () => {
    setComposition(prev => [
      ...prev,
      { productId: '', quantitySmall: 0, quantityLarge: 0, product: null }
    ]);
  };

  const handleRemoveProduct = (index) => {
    setComposition(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index, field, value) => {
    setComposition(prev => {
      const newComposition = [...prev];
      
      if (field === 'productId') {
        const selectedProduct = products.find(p => p.id === value);
        newComposition[index] = {
          ...newComposition[index],
          productId: value,
          product: selectedProduct
        };
      } else {
        newComposition[index] = {
          ...newComposition[index],
          [field]: parseFloat(value) || 0
        };
      }
      
      return newComposition;
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

    const hasInvalidProducts = composition.some(
      item => !item.productId || item.quantitySmall <= 0 || item.quantityLarge <= 0
    );

    if (hasInvalidProducts) {
      newErrors.composition = 'Tous les produits doivent avoir des quantités valides';
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
        weekNumber: parseInt(formData.weekNumber),
        year: parseInt(formData.year),
        distributionDate: formData.distributionDate,
        notes: formData.notes,
        items: composition.map(item => ({
          productId: item.productId,
          quantitySmall: parseFloat(item.quantitySmall),
          quantityLarge: parseFloat(item.quantityLarge)
        }))
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
            {/* Informations de base */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="weekNumber">
                  Semaine <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="weekNumber"
                  name="weekNumber"
                  min="1"
                  max="52"
                  value={formData.weekNumber}
                  onChange={handleChange}
                  className={errors.weekNumber ? 'input-error' : ''}
                />
                {errors.weekNumber && (
                  <span className="error-message">{errors.weekNumber}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="year">
                  Année <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className={errors.year ? 'input-error' : ''}
                />
                {errors.year && (
                  <span className="error-message">{errors.year}</span>
                )}
              </div>
            </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      <div className="composition-product-select">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                          required
                        >
                          <option value="">Sélectionner un produit</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.producer.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="composition-quantities">
                        <div className="quantity-input">
                          <label>Petit</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.quantitySmall}
                            onChange={(e) => handleProductChange(index, 'quantitySmall', e.target.value)}
                            placeholder="0"
                            required
                          />
                          <span className="unit">{item.product?.unit || 'kg'}</span>
                        </div>

                        <div className="quantity-input">
                          <label>Grand</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.quantityLarge}
                            onChange={(e) => handleProductChange(index, 'quantityLarge', e.target.value)}
                            placeholder="0"
                            required
                          />
                          <span className="unit">{item.product?.unit || 'kg'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-remove-product"
                        onClick={() => handleRemoveProduct(index)}
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
