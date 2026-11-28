'use client';

import { useState } from 'react';
import { CATEGORIES, SEASONS, BASKET_SIZES } from '../../lib/productLabels';

// « Je ne produis plus ce légume » : le mot suit la catégorie choisie.
export const NOUN = { VEGETABLES: 'ce légume', FRUITS: 'ce fruit', EGGS: 'ces œufs' };
export const nounOf = (category) => NOUN[category] ?? 'ce produit';

const EMPTY = { name: '', category: '', description: '', seasons: [], basketSizes: ['SMALL', 'LARGE'], isActive: true };

const formOf = (product) => (product ? {
  name: product.name,
  category: product.category ?? '',
  description: product.description ?? '',
  seasons: product.seasons,
  basketSizes: product.basketSizes,
  isActive: product.isActive,
} : EMPTY);

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Nom requis';
  if (form.seasons.length === 0) errors.seasons = 'Sélectionnez au moins une saison';
  if (form.basketSizes.length === 0) errors.basketSizes = 'Sélectionnez au moins un format de panier';
  return errors;
}

/* Création et modification. Pendant une demande de suppression, la case reste
   cochée et figée : le serveur refuse la réactivation tant que la demande court. */
export default function ProductForm({ product, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => formOf(product));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const idOf = (name) => `${product?.id ?? 'nouveau'}-${name}`;
  const deletionPending = Boolean(product?.deletionRequestedAt);

  const setField = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const toggle = (name, value) => () => {
    setForm((prev) => ({
      ...prev,
      [name]: prev[name].includes(value) ? prev[name].filter((item) => item !== value) : [...prev[name], value],
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        category: form.category || null,
        description: form.description.trim(),
        seasons: form.seasons,
        basketSizes: form.basketSizes,
        isActive: form.isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pspace-form pspace-product-form" noValidate>
      <div className="field">
        <label htmlFor={idOf('name')} className="field-label">
          Nom <span className="field-required">*</span>
        </label>
        <input
          id={idOf('name')}
          type="text"
          maxLength={200}
          className={`input ${errors.name ? 'input-error' : ''}`}
          value={form.name}
          onChange={setField('name')}
          aria-invalid={errors.name ? 'true' : undefined}
          aria-describedby={errors.name ? idOf('name-error') : undefined}
        />
        {errors.name && <span id={idOf('name-error')} className="field-error">{errors.name}</span>}
      </div>

      <div className="field">
        <label htmlFor={idOf('category')} className="field-label">Catégorie</label>
        <select id={idOf('category')} className="input" value={form.category} onChange={setField('category')}>
          <option value="">Sans catégorie</option>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor={idOf('description')} className="field-label">Description</label>
        <textarea
          id={idOf('description')}
          rows={3}
          maxLength={1000}
          className="textarea"
          value={form.description}
          onChange={setField('description')}
          aria-describedby={idOf('description-hint')}
        />
        <span id={idOf('description-hint')} className="field-hint">{form.description.length} / 1000 caractères</span>
      </div>

      <fieldset className="pspace-choices" aria-describedby={errors.seasons ? idOf('seasons-error') : undefined}>
        <legend className="field-label">Saisons <span className="field-required">*</span></legend>
        <div className="pspace-choice-list">
          {SEASONS.map((item) => (
            <label key={item.value} className="pspace-choice">
              <input type="checkbox" checked={form.seasons.includes(item.value)} onChange={toggle('seasons', item.value)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        {errors.seasons && <span id={idOf('seasons-error')} className="field-error">{errors.seasons}</span>}
      </fieldset>

      <fieldset className="pspace-choices" aria-describedby={errors.basketSizes ? idOf('sizes-error') : undefined}>
        <legend className="field-label">Paniers <span className="field-required">*</span></legend>
        <div className="pspace-choice-list">
          {BASKET_SIZES.map((item) => (
            <label key={item.value} className="pspace-choice">
              <input type="checkbox" checked={form.basketSizes.includes(item.value)} onChange={toggle('basketSizes', item.value)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        {errors.basketSizes && <span id={idOf('sizes-error')} className="field-error">{errors.basketSizes}</span>}
      </fieldset>

      <div className="field">
        <label className="pspace-choice pspace-choice-wide">
          <input
            type="checkbox"
            checked={!form.isActive}
            disabled={deletionPending}
            onChange={(event) => setForm((prev) => ({ ...prev, isActive: !event.target.checked }))}
            aria-describedby={idOf('active-hint')}
          />
          <span>Je ne produis plus {nounOf(form.category)}</span>
        </label>
        <span id={idOf('active-hint')} className="field-hint">
          {deletionPending
            ? 'Suppression demandée : annulez la demande pour proposer de nouveau ce produit.'
            : 'Coché, le produit n’entre plus dans les paniers.'}
        </span>
      </div>

      <div className="pspace-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
      </div>
    </form>
  );
}
