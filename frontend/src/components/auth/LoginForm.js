'use client';

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

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
    <form onSubmit={handleSubmit} className="auth-form">
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

export default LoginForm;