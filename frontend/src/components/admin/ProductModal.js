'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

const UNITS = [
  { value: 'kg', label: 'Kilogramme (kg)' },
  { value: 'g', label: 'Gramme (g)' },
  { value: 'pièce', label: 'Pièce' },
  { value: 'botte', label: 'Botte' },
  { value: 'bouquet', label: 'Bouquet' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'lot', label: 'Lot' },
  { value: 'barquette', label: 'Barquette' },
  { value: 'sachet', label: 'Sachet' },
];

export default function ProductModal({ product, producers, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    producerId: '',
    unit: 'kg',
    origin: '',
    description: '',
    isExample: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        producerId: product.producerId || '',
        unit: product.unit || 'kg',
        origin: product.origin || '',
        description: product.description || '',
        isExample: product.isExample ?? false,
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

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.producerId) {
      newErrors.producerId = 'Le producteur est requis';
    }

    if (!formData.unit) {
      newErrors.unit = 'L\'unité est requise';
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

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
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

            {/* Unité */}
            <div className="form-group">
              <label htmlFor="unit" className="form-label required">
                Unité de vente
              </label>
              <select
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className={`select ${errors.unit ? 'input-error' : ''}`}
              >
                {UNITS.map(unit => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
              {errors.unit && <span className="form-error">{errors.unit}</span>}
            </div>

            {/* Origine */}
            <div className="form-group">
              <label htmlFor="origin" className="form-label">
                Origine
              </label>
              <input
                type="text"
                id="origin"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
                className="input"
                placeholder="Ex: Île-de-France"
              />
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