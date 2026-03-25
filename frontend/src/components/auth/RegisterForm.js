'use client';

import { useState } from 'react';
import { Mail, Lock, User, Phone, MapPin, Eye, EyeOff } from 'lucide-react';

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="firstName" className="form-label">
            Prénom
          </label>
          <div className="input-wrapper">
            <User size={20} className="input-icon" aria-hidden="true" />
            <input
              type="text"
              id="firstName"
              name="firstName"
              className={`input input-with-icon ${errors.firstName ? 'input-error' : ''}`}
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Jean"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="given-name"
              aria-describedby={errors.firstName ? 'reg-firstName-error' : undefined}
            />
          </div>
          {errors.firstName && (
            <span id="reg-firstName-error" className="form-error">{errors.firstName}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lastName" className="form-label">
            Nom
          </label>
          <div className="input-wrapper">
            <User size={20} className="input-icon" aria-hidden="true" />
            <input
              type="text"
              id="lastName"
              name="lastName"
              className={`input input-with-icon ${errors.lastName ? 'input-error' : ''}`}
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Dupont"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="family-name"
              aria-describedby={errors.lastName ? 'reg-lastName-error' : undefined}
            />
          </div>
          {errors.lastName && (
            <span id="reg-lastName-error" className="form-error">{errors.lastName}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <div className="input-wrapper">
          <Mail size={20} className="input-icon" aria-hidden="true" />
          <input
            type="email"
            id="email"
            name="email"
            className={`input input-with-icon ${errors.email ? 'input-error' : ''}`}
            value={formData.email}
            onChange={handleChange}
            placeholder="votre@email.com"
            disabled={loading}
            required
            aria-required="true"
            autoComplete="email"
            aria-describedby={errors.email ? 'reg-email-error' : undefined}
          />
        </div>
        {errors.email && (
          <span id="reg-email-error" className="form-error">{errors.email}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="phone" className="form-label">
          Téléphone
        </label>
        <div className="input-wrapper">
          <Phone size={20} className="input-icon" aria-hidden="true" />
          <input
            type="tel"
            id="phone"
            name="phone"
            className={`input input-with-icon ${errors.phone ? 'input-error' : ''}`}
            value={formData.phone}
            onChange={handleChange}
            placeholder="06 12 34 56 78"
            disabled={loading}
            required
            aria-required="true"
            autoComplete="tel"
            aria-describedby={errors.phone ? 'reg-phone-error' : undefined}
          />
        </div>
        {errors.phone && (
          <span id="reg-phone-error" className="form-error">{errors.phone}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="street" className="form-label">
          Adresse
        </label>
        <div className="input-wrapper">
          <MapPin size={20} className="input-icon" aria-hidden="true" />
          <input
            type="text"
            id="street"
            name="street"
            className={`input input-with-icon ${errors.street ? 'input-error' : ''}`}
            value={formData.street}
            onChange={handleChange}
            placeholder="12 rue des Fleurs"
            disabled={loading}
            required
            aria-required="true"
            autoComplete="street-address"
            aria-describedby={errors.street ? 'reg-street-error' : undefined}
          />
        </div>
        {errors.street && (
          <span id="reg-street-error" className="form-error">{errors.street}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="postalCode" className="form-label">
            Code postal
          </label>
          <div className="input-wrapper">
            <input
              type="text"
              id="postalCode"
              name="postalCode"
              className={`input ${errors.postalCode ? 'input-error' : ''}`}
              value={formData.postalCode}
              onChange={handleChange}
              placeholder="75001"
              maxLength={5}
              disabled={loading}
              required
              aria-required="true"
              autoComplete="postal-code"
              aria-describedby={errors.postalCode ? 'reg-postalCode-error' : undefined}
            />
          </div>
          {errors.postalCode && (
            <span id="reg-postalCode-error" className="form-error">{errors.postalCode}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="city" className="form-label">
            Ville
          </label>
          <div className="input-wrapper">
            <input
              type="text"
              id="city"
              name="city"
              className={`input ${errors.city ? 'input-error' : ''}`}
              value={formData.city}
              onChange={handleChange}
              placeholder="Paris"
              disabled={loading}
              required
              aria-required="true"
              autoComplete="address-level2"
              aria-describedby={errors.city ? 'reg-city-error' : undefined}
            />
          </div>
          {errors.city && (
            <span id="reg-city-error" className="form-error">{errors.city}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Mot de passe
        </label>
        <div className="input-wrapper">
          <Lock size={20} className="input-icon" aria-hidden="true" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            className={`input input-with-icon ${errors.password ? 'input-error' : ''}`}
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={loading}
            required
            aria-required="true"
            autoComplete="new-password"
            aria-describedby={errors.password ? 'reg-password-error' : 'reg-password-hint'}
          />
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        {errors.password ? (
          <span id="reg-password-error" className="form-error">{errors.password}</span>
        ) : (
          <p id="reg-password-hint" className="form-hint">Minimum 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial</p>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword" className="form-label">
          Confirmer le mot de passe
        </label>
        <div className="input-wrapper">
          <Lock size={20} className="input-icon" aria-hidden="true" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            className={`input input-with-icon ${errors.confirmPassword ? 'input-error' : ''}`}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={loading}
            required
            aria-required="true"
            autoComplete="new-password"
            aria-describedby={errors.confirmPassword ? 'reg-confirmPassword-error' : undefined}
          />
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
          >
            {showConfirmPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <span id="reg-confirmPassword-error" className="form-error">{errors.confirmPassword}</span>
        )}
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="rgpdConsent"
          name="rgpdConsent"
          checked={formData.rgpdConsent}
          onChange={handleChange}
          disabled={loading}
        />
        <label htmlFor="rgpdConsent">
          En créant mon compte, j&apos;accepte que l&apos;association Aux P&apos;tits Pois collecte et traite mes données
          personnelles pour la gestion de mon abonnement, l&apos;organisation des distributions et les communications
          de l&apos;AMAP. Pour en savoir plus sur la gestion de vos données et vos droits, consultez nos{' '}
          <a href="/mentions-legales" target="_blank" rel="noopener noreferrer">Mentions Légales</a>.
        </label>
      </div>
      {errors.rgpdConsent && (
        <span className="form-error">{errors.rgpdConsent}</span>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg btn-full"
        disabled={loading}
      >
        {loading ? 'Inscription...' : 'S\'inscrire'}
      </button>
    </form>
  );
}

export default RegisterForm;