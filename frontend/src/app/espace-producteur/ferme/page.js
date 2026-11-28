'use client';

import { useEffect, useState } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import { CONTACT_EMAIL } from '../../../constants/association';

const FIELDS = ['description', 'specialty', 'farmDetailLabel', 'farmDetail', 'phone', 'image'];

const CERTIFICATION = { NONE: '—', ORGANIC: 'Certifiée AB', CONVERSION: 'En conversion bio' };

const formOf = (farm) => Object.fromEntries(FIELDS.map((name) => [name, farm[name] ?? '']));

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// Mêmes règles que le serveur, pour répondre avant l'envoi.
function validate(form) {
  const errors = {};
  if (!form.description.trim()) errors.description = 'Description requise';
  if (form.phone.trim() && !/^[0-9+\s.-]{6,20}$/.test(form.phone.trim())) errors.phone = 'Téléphone invalide';
  if (form.image.trim() && !isHttpsUrl(form.image.trim())) errors.image = 'Image : adresse https:// requise';
  return errors;
}

export default function ProducerFarmPage() {
  const { showError } = useModal();

  const [farm, setFarm] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api.producerSpace.getFarm()
      .then((response) => {
        setFarm(response.data.producer);
        setForm(formOf(response.data.producer));
      })
      .catch((error) => setLoadError(error.message));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved('');
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      const response = await api.producerSpace.updateFarm(
        Object.fromEntries(FIELDS.map((name) => [name, form[name].trim()]))
      );
      setFarm(response.data.producer);
      setForm(formOf(response.data.producer));
      setSaved(response.message);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="notice-band">
        <span className="notice-band-dot" aria-hidden="true" />
        <p className="notice-band-text">{loadError}</p>
      </div>
    );
  }

  if (!farm) {
    return <p className="pspace-loading">Chargement…</p>;
  }

  const fieldProps = (name) => ({
    id: name,
    name,
    value: form[name],
    onChange: handleChange,
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': [`${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(' '),
  });

  const imagePreview = form.image.trim() && isHttpsUrl(form.image.trim()) ? form.image.trim() : null;

  return (
    <>
      <header className="pspace-head">
        <div className="eyebrow">Espace producteur</div>
        <h1 className="pspace-title">{farm.name}</h1>
        <p className="pspace-lede">Ces informations s&apos;affichent sur la page Nos producteurs.</p>
      </header>

      <form onSubmit={handleSubmit} className="pspace-form" noValidate>
        <div className="field">
          <label htmlFor="description" className="field-label">
            Description <span className="field-required">*</span>
          </label>
          <textarea rows={6} maxLength={5000} className={`textarea ${errors.description ? 'input-error' : ''}`} {...fieldProps('description')} />
          <span id="description-hint" className="field-hint">{form.description.length} / 5000 caractères</span>
          {errors.description && <span id="description-error" className="field-error">{errors.description}</span>}
        </div>

        <div className="field">
          <label htmlFor="specialty" className="field-label">Spécialité</label>
          <input type="text" maxLength={200} className="input" {...fieldProps('specialty')} />
          <span id="specialty-hint" className="field-hint">200 caractères maximum</span>
        </div>

        <div className="pspace-pair">
          <div className="field">
            <label htmlFor="farmDetailLabel" className="field-label">Libellé du détail</label>
            <input type="text" maxLength={40} placeholder="Surface" className="input" {...fieldProps('farmDetailLabel')} />
            <span id="farmDetailLabel-hint" className="field-hint">40 caractères maximum</span>
          </div>
          <div className="field">
            <label htmlFor="farmDetail" className="field-label">Détail</label>
            <input type="text" maxLength={200} placeholder="4 hectares · 2 serres froides" className="input" {...fieldProps('farmDetail')} />
            <span id="farmDetail-hint" className="field-hint">200 caractères maximum</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="phone" className="field-label">Téléphone</label>
          <input type="tel" maxLength={20} autoComplete="tel" className={`input input-mono ${errors.phone ? 'input-error' : ''}`} {...fieldProps('phone')} />
          <span id="phone-hint" className="field-hint">Visible de l&apos;AMAP seulement, jamais publié.</span>
          {errors.phone && <span id="phone-error" className="field-error">{errors.phone}</span>}
        </div>

        <div className="field">
          <label htmlFor="image" className="field-label">Photo de la ferme</label>
          <input type="url" inputMode="url" maxLength={500} placeholder="https://" className={`input ${errors.image ? 'input-error' : ''}`} {...fieldProps('image')} />
          <span id="image-hint" className="field-hint">Adresse https:// d&apos;une photo déjà en ligne. Aucun envoi de fichier.</span>
          {errors.image && <span id="image-error" className="field-error">{errors.image}</span>}
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element -- URL libre saisie par le producteur : hôte et dimensions inconnus d'avance.
            <img src={imagePreview} alt="Aperçu de la photo de la ferme" className="pspace-photo" loading="lazy" />
          )}
        </div>

        {saved && (
          <div className="success-band" role="status">
            <span className="success-band-dot" aria-hidden="true" />
            <p className="success-band-text">{saved}</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg pspace-submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer la fiche'}
        </button>
      </form>

      <section className="pspace-card" aria-labelledby="pspace-amap-title">
        <h2 id="pspace-amap-title" className="pspace-card-title">Tenu par l&apos;AMAP</h2>
        <dl className="pspace-facts">
          <div><dt>Nom</dt><dd>{farm.name}</dd></div>
          <div><dt>Commune</dt><dd>{farm.city ? `${farm.city}${farm.postalCode ? ` (${farm.postalCode})` : ''}` : '—'}</dd></div>
          <div><dt>Distance au point de retrait</dt><dd>{farm.distanceKm != null ? `${farm.distanceKm} km` : '—'}</dd></div>
          <div><dt>Certification</dt><dd>{CERTIFICATION[farm.certification] ?? '—'}</dd></div>
          <div><dt>Partenaire depuis</dt><dd>{farm.partnerSince ?? '—'}</dd></div>
          <div><dt>Sur le site</dt><dd>{farm.isActive ? 'Visible' : 'Masquée'}</dd></div>
        </dl>
        <p className="pspace-card-note">
          Une correction ? Écrivez à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </>
  );
}
