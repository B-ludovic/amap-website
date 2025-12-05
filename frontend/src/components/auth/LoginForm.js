'use client';

import { useState } from 'react';

export default function LoginForm({ onSubmit, loading }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});

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
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email
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
        />
        {errors.email && (
          <span className="form-error">{errors.email}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Mot de passe
        </label>
        <input
          type="password"
          id="password"
          name="password"
          className={`input ${errors.password ? 'input-error' : ''}`}
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          disabled={loading}
        />
        {errors.password && (
          <span className="form-error">{errors.password}</span>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  );
}