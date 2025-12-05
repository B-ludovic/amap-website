'use client';

import { useState } from 'react';
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';

export default function RegisterForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
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
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmation requise';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (formData.phone && !/^[0-9\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Numéro de téléphone invalide';
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

    // Enlever confirmPassword avant d'envoyer au backend
    const { confirmPassword, ...dataToSend } = formData;
    onSubmit(dataToSend);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="firstName" className="form-label">
            Prénom
          </label>
          <div className="input-wrapper">
            <User size={20} className="input-icon" />
            <input
              type="text"
              id="firstName"
              name="firstName"
              className={`input input-with-icon ${errors.firstName ? 'input-error' : ''}`}
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Jean"
              disabled={loading}
            />
          </div>
          {errors.firstName && (
            <span className="form-error">{errors.firstName}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lastName" className="form-label">
            Nom
          </label>
          <div className="input-wrapper">
            <User size={20} className="input-icon" />
            <input
              type="text"
              id="lastName"
              name="lastName"
              className={`input input-with-icon ${errors.lastName ? 'input-error' : ''}`}
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Dupont"
              disabled={loading}
            />
          </div>
          {errors.lastName && (
            <span className="form-error">{errors.lastName}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <div className="input-wrapper">
          <Mail size={20} className="input-icon" />
          <input
            type="email"
            id="email"
            name="email"
            className={`input input-with-icon ${errors.email ? 'input-error' : ''}`}
            value={formData.email}
            onChange={handleChange}
            placeholder="votre@email.com"
            disabled={loading}
          />
        </div>
        {errors.email && (
          <span className="form-error">{errors.email}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="phone" className="form-label">
          Téléphone (optionnel)
        </label>
        <div className="input-wrapper">
          <Phone size={20} className="input-icon" />
          <input
            type="tel"
            id="phone"
            name="phone"
            className={`input input-with-icon ${errors.phone ? 'input-error' : ''}`}
            value={formData.phone}
            onChange={handleChange}
            placeholder="06 12 34 56 78"
            disabled={loading}
          />
        </div>
        {errors.phone && (
          <span className="form-error">{errors.phone}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Mot de passe
        </label>
        <div className="input-wrapper">
          <Lock size={20} className="input-icon" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            className={`input input-with-icon ${errors.password ? 'input-error' : ''}`}
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={loading}
          />
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {errors.password && (
          <span className="form-error">{errors.password}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword" className="form-label">
          Confirmer le mot de passe
        </label>
        <div className="input-wrapper">
          <Lock size={20} className="input-icon" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            className={`input input-with-icon ${errors.confirmPassword ? 'input-error' : ''}`}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={loading}
          />
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <span className="form-error">{errors.confirmPassword}</span>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? 'Inscription...' : 'S\'inscrire'}
      </button>
    </form>
  );
}