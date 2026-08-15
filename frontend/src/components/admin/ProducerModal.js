'use client';

import { useState, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import logger from '../../lib/logger';

export default function ProducerModal({ producer, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    description: '',
    city: '',
    postalCode: '',
    distanceKm: '',
    certification: 'NONE',
    farmDetailLabel: '',
    farmDetail: '',
    partnerSince: '',
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
        city: producer.city || '',
        postalCode: producer.postalCode || '',
        distanceKm: producer.distanceKm ?? '',
        certification: producer.certification || 'NONE',
        farmDetailLabel: producer.farmDetailLabel || '',
        farmDetail: producer.farmDetail || '',
        partnerSince: producer.partnerSince ?? '',
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

    if (formData.postalCode && !/^\d{5}$/.test(formData.postalCode)) {
      newErrors.postalCode = 'Code postal : 5 chiffres';
    }

    if (formData.partnerSince && !/^\d{4}$/.test(String(formData.partnerSince))) {
      newErrors.partnerSince = 'Année sur 4 chiffres';
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
      logger.error('Erreur création producteur:', error);
      showError('Erreur', error?.message || error?.toString() || 'Une erreur est survenue');
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
      <div className="modal-container modal-lg" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-producer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title-producer" className="modal-title">
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

            {/* Fiche de la ferme — alimente la page publique des producteurs */}
            <div className="form-group form-group-full">
              <p className="form-help">
                Les champs ci-dessous alimentent la fiche publique de la ferme. Laissés
                vides, les blocs correspondants ne s&apos;affichent pas.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="city" className="form-label">
                Ville
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="input"
                placeholder="Ex: Clamart"
              />
            </div>

            <div className="form-group">
              <label htmlFor="postalCode" className="form-label">
                Code postal
              </label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className={`input ${errors.postalCode ? 'input-error' : ''}`}
                inputMode="numeric"
                maxLength={5}
                placeholder="92140"
              />
              {errors.postalCode && <span className="form-error">{errors.postalCode}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="distanceKm" className="form-label">
                Distance du point de retrait (km)
              </label>
              <input
                type="number"
                id="distanceKm"
                name="distanceKm"
                value={formData.distanceKm}
                onChange={handleChange}
                className="input"
                min="0"
                max="300"
                placeholder="12"
              />
            </div>

            <div className="form-group">
              <label htmlFor="certification" className="form-label">
                Certification
              </label>
              <select
                id="certification"
                name="certification"
                value={formData.certification}
                onChange={handleChange}
                className="select"
              >
                <option value="NONE">Aucune mention</option>
                <option value="ORGANIC">Certifiée AB</option>
                <option value="CONVERSION">En conversion bio</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="farmDetailLabel" className="form-label">
                Libellé du détail
              </label>
              <input
                type="text"
                id="farmDetailLabel"
                name="farmDetailLabel"
                value={formData.farmDetailLabel}
                onChange={handleChange}
                className="input"
                placeholder="Ex: Surface, Cheptel"
              />
            </div>

            <div className="form-group">
              <label htmlFor="farmDetail" className="form-label">
                Détail de l&apos;exploitation
              </label>
              <input
                type="text"
                id="farmDetail"
                name="farmDetail"
                value={formData.farmDetail}
                onChange={handleChange}
                className="input"
                placeholder="Ex: 4 hectares · 2 serres froides"
              />
            </div>

            <div className="form-group">
              <label htmlFor="partnerSince" className="form-label">
                Partenaire depuis
              </label>
              <input
                type="number"
                id="partnerSince"
                name="partnerSince"
                value={formData.partnerSince}
                onChange={handleChange}
                className={`input ${errors.partnerSince ? 'input-error' : ''}`}
                min="1900"
                max="2200"
                placeholder="2018"
              />
              {errors.partnerSince && <span className="form-error">{errors.partnerSince}</span>}
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
            className="admin-btn-primary"
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