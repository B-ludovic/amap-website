'use client';

import { useState } from 'react';

function LoginForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

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

    if (!formData.email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.password) {
      newErrors.password = 'Mot de passe requis';
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

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form" noValidate>
      <div className="field">
        <label htmlFor="email" className="field-label">Email</label>
        <input
          type="text"
          inputMode="email"
          id="email"
          name="email"
          className={`input ${errors.email ? 'input-error' : ''}`}
          value={formData.email}
          onChange={handleChange}
          placeholder="votre@email.com"
          disabled={loading}
          autoComplete="email"
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
        />
        {errors.email && (
          <span id="login-email-error" className="field-error">{errors.email}</span>
        )}
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="password" className="field-label">Mot de passe</label>
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
          type={showPassword ? 'text' : 'password'}
          id="password"
          name="password"
          className={`input ${errors.password ? 'input-error' : ''}`}
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          disabled={loading}
          autoComplete="current-password"
          aria-invalid={errors.password ? 'true' : undefined}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
        />
        {errors.password && (
          <span id="login-password-error" className="field-error">{errors.password}</span>
        )}
      </div>

      <button type="submit" className="form-submit login-submit" disabled={loading}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}

export default LoginForm;
