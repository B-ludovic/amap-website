'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';

export default function ProducerModal({ producer, onClose }) {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    description: '',
    isActive: true,
    isExample: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (producer) {
      setFormData({
        name: producer.name || '',
        email: producer.email || '',
        phone: producer.phone || '',
        specialty: producer.specialty || '',
        description: producer.description || '',
        isActive: producer.isActive ?? true,
        isExample: producer.isExample ?? false,
      });
    }
  }, [producer]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Effacer l'erreur du champ modifié
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      showError('Formulaire incomplet', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      if (producer) {
        // Modification
        await api.admin.producers.update(producer.id, formData);
        showSuccess('Producteur modifié', `${formData.name} a été modifié avec succès.`);
      } else {
        // Création
        await api.admin.producers.create(formData);
        showSuccess('Producteur créé', `${formData.name} a été créé avec succès.`);
      }
      onClose(true); // true = refresh la liste
    } catch (error) {
      console.error('Erreur création producteur:', error);
      showError('Erreur', error?.message || error?.toString() || 'Une erreur est survenue');
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
            {producer ? 'Modifier le producteur' : 'Ajouter un producteur'}
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
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
            {/* Nom */}
            <div className="form-group">
              <label htmlFor="name" className="form-label required">
                Nom du producteur
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="Ex: Ferme des Lilas"
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label required">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="contact@ferme.fr"
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            {/* Téléphone */}
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                Téléphone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input"
                placeholder="06 12 34 56 78"
              />
            </div>

            {/* Spécialité */}
            <div className="form-group">
              <label htmlFor="specialty" className="form-label">
                Spécialité
              </label>
              <input
                type="text"
                id="specialty"
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                className="input"
                placeholder="Ex: Légumes de saison"
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
                rows="4"
                placeholder="Présentez le producteur..."
              />
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
                <span>Producteur actif</span>
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
        </div>

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
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : producer ? 'Modifier' : 'Créer'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}