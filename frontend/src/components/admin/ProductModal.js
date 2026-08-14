'use client';

import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

export default function ProductModal({ product, producers, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    producerId: '',
    category: '',
    description: '',
    isExample: false,
    isActive: true,
    seasons: [],
    basketSizes: ['SMALL', 'LARGE'],
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        producerId: product.producerId || '',
        category: product.category || '',
        description: product.description || '',
        isExample: product.isExample ?? false,
        isActive: product.isActive ?? true,
        seasons: product.seasons || [],
        basketSizes: product.basketSizes || ['SMALL', 'LARGE'],
      });
    }
  }, [product]);

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

  const handleArrayChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.producerId) {
      newErrors.producerId = 'Le producteur est requis';
    }

    if (formData.seasons.length === 0) newErrors.seasons = 'Sélectionnez au moins une saison';
    if (formData.basketSizes.length === 0) newErrors.basketSizes = 'Sélectionnez au moins un format';

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
      if (product) {
        await api.admin.products.update(product.id, formData);
        showSuccess('Produit modifié', `${formData.name} a été modifié avec succès.`);
      } else {
        await api.admin.products.create(formData);
        showSuccess('Produit créé', `${formData.name} a été créé avec succès.`);
      }
      onClose(true);
    } catch (error) {
      showError('Erreur', error.message);
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
      <div className="modal-container modal-lg" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-product" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title-product" className="modal-title">
            {product ? 'Modifier le produit' : 'Ajouter un produit'}
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
                Nom du produit
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="Ex: Carottes"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Producteur */}
            <div className="form-group">
              <label htmlFor="producerId" className="form-label required">
                Producteur
              </label>
              <select
                id="producerId"
                name="producerId"
                value={formData.producerId}
                onChange={handleChange}
                className={`select ${errors.producerId ? 'input-error' : ''}`}
              >
                <option value="">Sélectionner un producteur</option>
                {producers.map(producer => (
                  <option key={producer.id} value={producer.id}>
                    {producer.name}
                  </option>
                ))}
              </select>
              {errors.producerId && <span className="form-error">{errors.producerId}</span>}
            </div>

            {/* Catégorie */}
            <div className="form-group">
              <label htmlFor="category" className="form-label">
                Catégorie
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="select"
              >
                <option value="">Aucune catégorie</option>
                <option value="VEGETABLES">Légumes</option>
                <option value="FRUITS">Fruits</option>
                <option value="EGGS">Œufs</option>
                <option value="GROCERY">Épicerie</option>
              </select>
            </div>

            {/* Description */}
            <div className="form-group form-group-full">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="textarea"
                rows="3"
                placeholder="Décrivez le produit..."
              />
            </div>

            <fieldset className="form-group form-group-full">
              <legend className="form-label">Saisons <span className="required">*</span></legend>
              {[
                ['SPRING', 'Printemps'], ['SUMMER', 'Été'], ['AUTUMN', 'Automne'], ['WINTER', 'Hiver']
              ].map(([value, label]) => (
                <label className="form-checkbox" key={value}>
                  <input type="checkbox" checked={formData.seasons.includes(value)} onChange={() => handleArrayChange('seasons', value)} />
                  <span>{label}</span>
                </label>
              ))}
              {errors.seasons && <span className="form-error">{errors.seasons}</span>}
            </fieldset>

            <fieldset className="form-group form-group-full">
              <legend className="form-label">Formats éligibles <span className="required">*</span></legend>
              {[
                ['SMALL', 'Petit panier'], ['LARGE', 'Grand panier']
              ].map(([value, label]) => (
                <label className="form-checkbox" key={value}>
                  <input type="checkbox" checked={formData.basketSizes.includes(value)} onChange={() => handleArrayChange('basketSizes', value)} />
                  <span>{label}</span>
                </label>
              ))}
              {errors.basketSizes && <span className="form-error">{errors.basketSizes}</span>}
            </fieldset>

            <div className="form-group form-group-full">
              <label className="form-checkbox">
                <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
                <span>Disponible pour les paniers à générer</span>
              </label>
            </div>

            {/* Est un exemple */}
            <div className="form-group form-group-full">
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
            {loading ? 'Enregistrement...' : product ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}