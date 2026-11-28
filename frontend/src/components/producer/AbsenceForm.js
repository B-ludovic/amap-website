'use client';

import { useState } from 'react';

// Les dates voyagent en « AAAA-MM-JJ » : une date du calendrier, sans heure ni fuseau.
const dayOf = (value) => (value ? String(value).slice(0, 10) : '');

function validate(form) {
  const errors = {};
  if (!form.startDate) errors.startDate = 'Date de début requise';
  if (!form.endDate) errors.endDate = 'Date de fin requise';
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = 'La date de fin précède la date de début';
  }
  return errors;
}

export default function AbsenceForm({ absence, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({
    startDate: dayOf(absence?.startDate),
    endDate: dayOf(absence?.endDate),
    reason: absence?.reason ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const idOf = (name) => `${absence?.id ?? 'nouvelle'}-${name}`;

  const setField = (name) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      await onSubmit({ startDate: form.startDate, endDate: form.endDate, reason: form.reason.trim() });
    } finally {
      setSaving(false);
    }
  };

  const dateField = (name, label) => (
    <div className="field">
      <label htmlFor={idOf(name)} className="field-label">
        {label} <span className="field-required">*</span>
      </label>
      <input
        id={idOf(name)}
        type="date"
        className={`input ${errors[name] ? 'input-error' : ''}`}
        value={form[name]}
        onChange={setField(name)}
        aria-invalid={errors[name] ? 'true' : undefined}
        aria-describedby={errors[name] ? idOf(`${name}-error`) : undefined}
      />
      {errors[name] && <span id={idOf(`${name}-error`)} className="field-error">{errors[name]}</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="pspace-form pspace-product-form" noValidate>
      <div className="pspace-pair pspace-pair-even">
        {dateField('startDate', 'Du')}
        {dateField('endDate', 'Au')}
      </div>

      <div className="field">
        <label htmlFor={idOf('reason')} className="field-label">Motif</label>
        <input
          id={idOf('reason')}
          type="text"
          maxLength={500}
          className="input"
          value={form.reason}
          onChange={setField('reason')}
          aria-describedby={idOf('reason-hint')}
        />
        <span id={idOf('reason-hint')} className="field-hint">Facultatif, lu par l&apos;AMAP seulement.</span>
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
