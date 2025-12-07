'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Users, Send, Clock } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import '../../styles/admin/components.css';

export default function NewsletterModal({ newsletter, onClose }) {
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    type: 'GENERAL',
    target: 'ALL'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [sendMode, setSendMode] = useState(null); // null, 'now', 'schedule'
  const [scheduledFor, setScheduledFor] = useState('');
  
  const { showModal } = useModal();
  const { user } = useAuth();
  const isEdit = !!newsletter;

  useEffect(() => {
    if (newsletter) {
      setFormData({
        subject: newsletter.subject,
        content: newsletter.content,
        type: newsletter.type,
        target: newsletter.target
      });
      if (newsletter.scheduledFor) {
        setScheduledFor(newsletter.scheduledFor.split('.')[0]);
      }
    }
  }, [newsletter]);

  const validate = () => {
    const newErrors = {};

    if (!formData.subject?.trim()) {
      newErrors.subject = 'Sujet requis';
    }

    if (!formData.content?.trim()) {
      newErrors.content = 'Contenu requis';
    }

    if (sendMode === 'schedule' && !scheduledFor) {
      newErrors.scheduledFor = 'Date et heure requises';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      if (isEdit) {
        await api.newsletters.update(newsletter.id, formData);
        showModal('Newsletter modifiée avec succès', 'success');
      } else {
        const response = await api.newsletters.create(formData);
        
        // Si envoi immédiat
        if (sendMode === 'now') {
          await api.newsletters.send(response.data.id);
          showModal('Newsletter créée et envoyée avec succès', 'success');
        } 
        // Si programmation
        else if (sendMode === 'schedule') {
          await api.newsletters.schedule(response.data.id, { scheduledFor });
          showModal('Newsletter programmée avec succès', 'success');
        } 
        // Sinon juste brouillon
        else {
          showModal('Newsletter sauvegardée en brouillon', 'success');
        }
      }

      onClose(true);
    } catch (error) {
      showModal(
        error.response?.data?.message || 'Une erreur est survenue',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const typeOptions = [
    { value: 'GENERAL', label: 'Général' },
    { value: 'WEEKLY_BASKET', label: 'Panier de la semaine' },
    { value: 'RECIPE', label: 'Recette' },
    { value: 'ALERT', label: 'Alerte' },
    { value: 'PRODUCER_NEWS', label: 'Nouvelles des producteurs' }
  ];

  const targetOptions = [
    { value: 'ALL', label: 'Tous les adhérents' },
    { value: 'ACTIVE_SUBSCRIBERS', label: 'Abonnés actifs uniquement' },
    { value: 'SOLIDARITY', label: 'Tarif solidaire' },
    { value: 'TEST', label: 'Test (moi uniquement)' }
  ];

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Modifier la newsletter' : 'Nouvelle newsletter'}</h2>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="subject">
                  <Mail size={18} />
                  Sujet *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Ex: Panier de la semaine du 15 janvier"
                  className={errors.subject ? 'input-error' : ''}
                  required
                />
                {errors.subject && (
                  <span className="error-message">{errors.subject}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Type</label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                  >
                    {typeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="target">
                    <Users size={18} />
                    Destinataires
                  </label>
                  <select
                    id="target"
                    name="target"
                    value={formData.target}
                    onChange={handleChange}
                  >
                    {targetOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="content">
                  Contenu *
                </label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  rows="12"
                  placeholder="Rédigez votre message..."
                  className={errors.content ? 'input-error' : ''}
                  required
                />
                {errors.content && (
                  <span className="error-message">{errors.content}</span>
                )}
              </div>

              {!isEdit && (
                <div className="form-group">
                  <label>Action après sauvegarde</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="sendMode"
                        checked={sendMode === null}
                        onChange={() => setSendMode(null)}
                      />
                      <span>Sauvegarder en brouillon</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="sendMode"
                        checked={sendMode === 'now'}
                        onChange={() => setSendMode('now')}
                      />
                      <span>Envoyer maintenant</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="sendMode"
                        checked={sendMode === 'schedule'}
                        onChange={() => setSendMode('schedule')}
                      />
                      <span>Programmer l'envoi</span>
                    </label>
                  </div>
                </div>
              )}

              {sendMode === 'schedule' && (
                <div className="form-group">
                  <label htmlFor="scheduledFor">
                    <Clock size={18} />
                    Date et heure d'envoi
                  </label>
                  <input
                    type="datetime-local"
                    id="scheduledFor"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className={errors.scheduledFor ? 'input-error' : ''}
                  />
                  {errors.scheduledFor && (
                    <span className="error-message">{errors.scheduledFor}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onClose(false)}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : 
               sendMode === 'now' ? 'Créer et envoyer' :
               sendMode === 'schedule' ? 'Créer et programmer' :
               isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}