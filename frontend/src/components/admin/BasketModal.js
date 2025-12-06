'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

export default function BasketModal({ basket, products, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    isActive: true,
    isExample: false,
  });
  const [composition, setComposition] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (basket) {
      setFormData({
        name: basket.name || '',
        description: basket.description || '',
        price: basket.price ? parseFloat(basket.price).toFixed(2) : '',
        isActive: basket.isActive ?? true,
        isExample: basket.isExample ?? false,
      });
      
      // Charger la composition existante
      if (basket.products && basket.products.length > 0) {
        setComposition(
          basket.products.map(bp => ({
            productId: bp.product?.id || bp.productId,
            quantity: bp.quantity,
            product: bp.product
          }))
        );
      }
    }
  }, [basket]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddProduct = () => {
    setComposition(prev => [
      ...prev,
      { productId: '', quantity: 1, product: null }
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
          [field]: value
        };
      }
      
      return newComposition;
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La description est requise';
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Le prix doit être supérieur à 0';
    }

    if (composition.length === 0) {
      newErrors.composition = 'Le panier doit contenir au moins un produit';
    } else {
      const hasInvalidProduct = composition.some(item => !item.productId);
      const hasInvalidQuantity = composition.some(item => !item.quantity || item.quantity <= 0);
      
      if (hasInvalidProduct) {
        newErrors.composition = 'Tous les produits doivent être sélectionnés';
      } else if (hasInvalidQuantity) {
        newErrors.composition = 'Toutes les quantités doivent être supérieures à 0';
      }
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
      const basketData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        isActive: formData.isActive,
        isExample: formData.isExample,
        products: composition.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity)
        }))
      };

      if (basket) {
        await api.admin.baskets.update(basket.id, basketData);
        showSuccess('Panier modifié', `${formData.name} a été modifié avec succès.`);
      } else {
        await api.admin.baskets.create(basketData);
        showSuccess('Panier créé', `${formData.name} a été créé avec succès.`);
      }
      onClose(true);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const availableProducts = products.filter(
    p => !composition.find(c => c.productId === p.id)
  );

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {basket ? 'Modifier le panier' : 'Ajouter un panier'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="modal-close-btn"
            aria-label="Fermer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            {/* Nom */}
            <div className="form-group">
              <label htmlFor="name" className="form-label required">
                Nom du panier
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="Ex: Panier Découverte"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Prix */}
            <div className="form-group">
              <label htmlFor="price" className="form-label required">
                Prix (€)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`input ${errors.price ? 'input-error' : ''}`}
                placeholder="25.00"
                step="0.01"
                min="0"
              />
              {errors.price && <span className="form-error">{errors.price}</span>}
            </div>

            {/* Description */}
            <div className="form-group form-group-full">
              <label htmlFor="description" className="form-label required">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={`textarea ${errors.description ? 'input-error' : ''}`}
                rows="3"
                placeholder="Décrivez le panier..."
              />
              {errors.description && <span className="form-error">{errors.description}</span>}
            </div>

            {/* Composition */}
            <div className="form-group form-group-full">
              <div className="basket-composition-header">
                <label className="form-label required">
                  Composition du panier
                </label>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="btn btn-outline btn-sm"
                  disabled={availableProducts.length === 0}
                >
                  <Plus size={16} />
                  Ajouter un produit
                </button>
              </div>

              {errors.composition && (
                <span className="form-error">{errors.composition}</span>
              )}

              {composition.length === 0 ? (
                <div className="basket-composition-empty">
                  <p>Aucun produit dans ce panier</p>
                </div>
              ) : (
                <div className="basket-composition-list">
                  {composition.map((item, index) => (
                    <div key={index} className="basket-composition-item">
                      <div className="basket-composition-item-product">
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                          className="select"
                        >
                          <option value="">Sélectionner un produit</option>
                          {item.productId && item.product && (
                            <option value={item.productId}>
                              {item.product.name} ({item.product.unit})
                            </option>
                          )}
                          {availableProducts.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="basket-composition-item-quantity">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', parseFloat(e.target.value))}
                          className="input"
                          placeholder="Quantité"
                          step="0.1"
                          min="0.1"
                        />
                        {item.product && (
                          <span className="basket-composition-item-unit">
                            {item.product.unit}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(index)}
                        className="basket-composition-item-remove"
                        title="Retirer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Statut actif */}
            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <span>Panier actif</span>
              </label>
            </div>

            {/* Est un exemple */}
            <div className="form-group">
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  name="isExample"
                  checked={formData.isExample}
                  onChange={handleChange}
                />
                <span>Marquer comme exemple</span>
              </label>
              <p className="form-help">
                Les exemples peuvent être supprimés en masse depuis les paramètres
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="btn btn-outline"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : basket ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}