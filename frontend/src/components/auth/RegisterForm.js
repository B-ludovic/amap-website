'use client';

import { useState } from 'react';

/* Règles du mot de passe, affichées en pastilles sous le champ. Elles doublent
   la validation ci-dessous : la liste montre l'état, validate() bloque l'envoi. */
const PASSWORD_RULES = [
  { label: '12 caractères minimum', test: (v) => v.length >= 12 },
  { label: 'Une majuscule', test: (v) => /[A-Z]/.test(v) },
  { label: 'Une minuscule', test: (v) => /[a-z]/.test(v) },
  { label: 'Un chiffre', test: (v) => /[0-9]/.test(v) },
  { label: 'Un caractère spécial', test: (v) => /[\W_]/.test(v) },
];

function RegisterForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    street: '',
    postalCode: '',
    city: '',
    rgpdConsent: false,
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    // Effacer l'erreur du champ modifié
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName) {
      newErrors.firstName = 'Prénom requis';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Nom requis';
    }

    if (!formData.email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Le mot de passe doit contenir au moins 12 caractères';
    } else if (!/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password) || !/[\W_]/.test(formData.password)) {
      newErrors.password = 'Doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmation requise';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!formData.phone) {
      newErrors.phone = 'Téléphone requis';
    } else if (!/^[0-9\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Numéro de téléphone invalide';
    }

    if (!formData.street) {
      newErrors.street = 'Adresse requise';
    }

    if (!formData.postalCode) {
      newErrors.postalCode = 'Code postal requis';
    } else if (!/^\d{5}$/.test(formData.postalCode)) {
      newErrors.postalCode = 'Code postal invalide (5 chiffres)';
    }

    if (!formData.city) {
      newErrors.city = 'Ville requise';
    }

    if (!formData.rgpdConsent) {
      newErrors.rgpdConsent = 'Vous devez accepter la politique de confidentialité';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Concaténer l'adresse et enlever les champs séparés
    const { confirmPassword, street, postalCode, city, rgpdConsent, ...rest } = formData;
    onSubmit({ ...rest, address: `${street}, ${postalCode} ${city}` });
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const passwordType = showPassword ? 'text' : 'password';

  return (
    <>
      {errorCount > 0 && (
        <div className="form-alert register-alert" role="alert">
          <span className="form-alert-dot" aria-hidden="true" />
          <span className="form-alert-text">
            {errorCount === 1
              ? 'Un champ demande votre attention avant l’envoi.'
              : `${errorCount} champs demandent votre attention avant l’envoi.`}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form" noValidate>

        <fieldset className="register-fieldset">
          <legend className="register-legend">01 · Qui êtes-vous</legend>

          <div className="register-row">
            <div className="field">
              <label htmlFor="firstName" className="field-label">
                Prénom <span className="field-required">*</span>
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                className={`input ${errors.firstName ? 'input-error' : ''}`}
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Jean"
                disabled={loading}
                required
                aria-required="true"
                autoComplete="given-name"
                aria-describedby={errors.firstName ? 'reg-firstName-error' : undefined}
              />
              {errors.firstName && (
                <span id="reg-firstName-error" className="field-error">{errors.firstName}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="lastName" className="field-label">
                Nom <span className="field-required">*</span>
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className={`input ${errors.lastName ? 'input-error' : ''}`}
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Dupont"
                disabled={loading}
                required
                aria-required="true"
                autoComplete="family-name"
                aria-describedby={errors.lastName ? 'reg-lastName-error' : undefined}
              />
              {errors.lastName && (
                <span id="reg-lastName-error" className="field-error">{errors.lastName}</span>
              )}
            </div>
          </div>

          <div className="register-row">
            <div className="field">
              <label htmlFor="email" className="field-label">
                Email <span className="field-required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                value={formData.email}
                onChange={handleChange}
                placeholder="votre@email.com"
                disabled={loading}
                required
                aria-required="true"
                autoComplete="email"
                aria-describedby={errors.email ? 'reg-email-error' : undefined}
              />
              {errors.email && (
                <span id="reg-email-error" className="field-error">{errors.email}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="phone" className="field-label">
                Téléphone <span className="field-required">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className={`input input-mono ${errors.phone ? 'input-error' : ''}`}
                value={formData.phone}
                onChange={handleChange}
                placeholder="06 12 34 56 78"
                disabled={loading}
                required
                aria-required="true"
                autoComplete="tel"
                aria-describedby={errors.phone ? 'reg-phone-error' : undefined}
              />
              {errors.phone && (
                <span id="reg-phone-error" className="field-error">{errors.phone}</span>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="register-fieldset">
          <legend className="register-legend">02 · Où vous joindre</legend>

          <div className="field">
            <label htmlFor="street" className="field-label">
              Adresse <span className="field-required">*</span>
            </label>
            <input
              type="text"
              id="street"
              name="street"
              className={`input ${errors.street ? 'input-error' : ''}`}
              value={formData.street}
              onChange={handleChange}
              placeholder="12 rue des Fleurs"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="street-address"
              aria-describedby={errors.street ? 'reg-street-error' : undefined}
            />
            {errors.street && (
              <span id="reg-street-error" className="field-error">{errors.street}</span>
            )}
          </div>

          <div className="register-row register-row-address">
            <div className="field">
              <label htmlFor="postalCode" className="field-label">
                Code postal <span className="field-required">*</span>
              </label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                inputMode="numeric"
                className={`input input-mono ${errors.postalCode ? 'input-error' : ''}`}
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="92140"
                maxLength={5}
                disabled={loading}
                required
                aria-required="true"
                autoComplete="postal-code"
                aria-describedby={errors.postalCode ? 'reg-postalCode-error' : undefined}
              />
              {errors.postalCode && (
                <span id="reg-postalCode-error" className="field-error">{errors.postalCode}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="city" className="field-label">
                Ville <span className="field-required">*</span>
              </label>
              <input
                type="text"
                id="city"
                name="city"
                className={`input ${errors.city ? 'input-error' : ''}`}
                value={formData.city}
                onChange={handleChange}
                placeholder="Clamart"
                disabled={loading}
                required
                aria-required="true"
                autoComplete="address-level2"
                aria-describedby={errors.city ? 'reg-city-error' : undefined}
              />
              {errors.city && (
                <span id="reg-city-error" className="field-error">{errors.city}</span>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="register-fieldset">
          <legend className="register-legend">03 · Sécuriser le compte</legend>

          <div className="field">
            <div className="field-head">
              <label htmlFor="password" className="field-label">
                Mot de passe <span className="field-required">*</span>
              </label>
              <button
                type="button"
                className="reveal-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <input
              type={passwordType}
              id="password"
              name="password"
              className={`input ${errors.password ? 'input-error' : ''}`}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••••••"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="new-password"
              aria-describedby={errors.password ? 'reg-password-error' : 'reg-password-rules'}
            />
            {errors.password && (
              <span id="reg-password-error" className="field-error">{errors.password}</span>
            )}

            <ul id="reg-password-rules" className="register-rules">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(formData.password);
                return (
                  <li
                    key={rule.label}
                    className={`register-rule ${met ? 'register-rule-on' : ''}`}
                  >
                    <span className="register-rule-dot" aria-hidden="true" />
                    <span className="register-rule-label">
                      {rule.label}
                      <span className="sr-only">{met ? ' — règle respectée' : ' — règle non respectée'}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword" className="field-label">
              Confirmer le mot de passe <span className="field-required">*</span>
            </label>
            <input
              type={passwordType}
              id="confirmPassword"
              name="confirmPassword"
              className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••••••"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="new-password"
              aria-describedby={errors.confirmPassword ? 'reg-confirmPassword-error' : undefined}
            />
            {errors.confirmPassword && (
              <span id="reg-confirmPassword-error" className="field-error">{errors.confirmPassword}</span>
            )}
          </div>
        </fieldset>

        <fieldset className="register-fieldset register-consent-set">
          <legend className="register-legend">04 · Vos données</legend>

          <label
            htmlFor="rgpdConsent"
            className={`register-consent ${errors.rgpdConsent ? 'register-consent-error' : ''}`}
          >
            <input
              type="checkbox"
              id="rgpdConsent"
              name="rgpdConsent"
              className="register-consent-box"
              checked={formData.rgpdConsent}
              onChange={handleChange}
              disabled={loading}
              aria-describedby={errors.rgpdConsent ? 'reg-rgpd-error' : undefined}
            />
            <span className="register-consent-text">
              En créant mon compte, j&apos;accepte que l&apos;association Aux P&apos;tits Pois
              collecte et traite mes données personnelles pour la gestion de mon abonnement,
              l&apos;organisation des distributions et les communications de l&apos;AMAP. Pour
              en savoir plus sur vos droits, consultez les{' '}
              <a href="/mentions-legales" target="_blank" rel="noopener noreferrer">
                mentions légales
              </a>.
            </span>
          </label>
          {errors.rgpdConsent && (
            <span id="reg-rgpd-error" className="field-error">{errors.rgpdConsent}</span>
          )}
        </fieldset>

        <div className="register-send">
          <button type="submit" className="form-submit" disabled={loading}>
            {loading ? 'Création du compte…' : 'Créer mon compte'}
          </button>
          <p className="form-note">
            Vos données ne sont ni revendues ni partagées. Vous pouvez exporter ou supprimer
            votre compte à tout moment depuis votre espace adhérent.
          </p>
        </div>
      </form>
    </>
  );
}

export default RegisterForm;
