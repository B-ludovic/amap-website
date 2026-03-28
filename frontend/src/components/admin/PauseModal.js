'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X, PauseCircle, AlertTriangle } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

function formatDateFR(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function PauseModal({ subscription, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);
  const { showConfirm } = useModal();
  const [startDate, setStartDate] = useState(todayISO());
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const daysUsed = useMemo(() => {
    if (!subscription?.pauses?.length) return 0;
    return subscription.pauses.reduce((sum, p) =>
      sum + Math.round((new Date(p.endDate) - new Date(p.startDate)) / 86400000), 0
    );
  }, [subscription]);

  const weeksUsed = Math.round(daysUsed / 7);
  const weeksRemaining = 2 - weeksUsed;
  const endDate = addDays(startDate, durationWeeks * 7);

  function handleConfirm() {
    showConfirm(
      'Confirmer la mise en pause',
      `Mettre en pause l'abonnement du ${formatDateFR(startDate)} au ${formatDateFR(endDate)} ? Aucune distribution ne sera générée pendant cette période.`,
      async () => {
        setError('');
        setLoading(true);
        try {
          const { default: api } = await import('../../lib/api');
          await api.subscriptions.pause(subscription.id, { startDate, endDate, reason: reason || undefined });
          onClose(true);
        } catch (err) {
          setError(err.response?.data?.message || 'Erreur lors de la mise en pause');
        } finally {
          setLoading(false);
        }
      }
    );
  }

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(false); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container" ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="modal-title-pause" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <PauseCircle size={20} />
            <h2 id="modal-title-pause" className="modal-title">Mettre en pause l&apos;abonnement</h2>
          </div>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Abonné */}
          <p className="pause-modal-subscriber">
            {subscription?.user?.firstName} {subscription?.user?.lastName}
            <span className="pause-modal-sub-number"> · {subscription?.subscriptionNumber}</span>
          </p>

          {/* Compteur semaines */}
          <div className={`pause-weeks-counter ${weeksRemaining === 0 ? 'exhausted' : ''}`}>
            <span>Semaines de pause utilisées :</span>
            <strong>{weeksUsed} / 2</strong>
          </div>

          {weeksRemaining === 0 ? (
            <div className="pause-modal-error">
              <AlertTriangle size={16} />
              <span>La limite de 2 semaines de pause est atteinte pour cet abonnement.</span>
            </div>
          ) : (
            <>
              {/* Date de début */}
              <div className="form-group">
                <label className="form-label">Date de début</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  min={todayISO()}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {/* Durée */}
              <div className="form-group">
                <label className="form-label">Durée</label>
                <div className="pause-duration-buttons">
                  <button
                    className={`pause-duration-btn ${durationWeeks === 1 ? 'active' : ''}`}
                    onClick={() => setDurationWeeks(1)}
                  >
                    1 semaine
                  </button>
                  <button
                    className={`pause-duration-btn ${durationWeeks === 2 ? 'active' : ''}`}
                    onClick={() => setDurationWeeks(2)}
                    disabled={weeksRemaining < 2}
                    title={weeksRemaining < 2 ? 'Quota insuffisant' : ''}
                  >
                    2 semaines
                  </button>
                </div>
              </div>

              {/* Date de fin calculée */}
              <div className="form-group">
                <label className="form-label">Date de fin (calculée)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formatDateFR(endDate)}
                  readOnly
                />
              </div>

              {/* Raison */}
              <div className="form-group">
                <label className="form-label">Raison <span className="form-optional">(optionnel)</span></label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex : vacances, maladie…"
                />
              </div>

              {/* Avertissement */}
              <div className="pause-modal-warning">
                <AlertTriangle size={16} />
                <div>
                  <strong>Êtes-vous sûr ?</strong> Aucune distribution ne sera générée du{' '}
                  <strong>{formatDateFR(startDate)}</strong> au <strong>{formatDateFR(endDate)}</strong>.
                  Il restera <strong>{weeksRemaining - durationWeeks}</strong> semaine(s) de pause disponible(s).
                </div>
              </div>

              {error && (
                <div className="pause-modal-error">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onClose(false)} disabled={loading}>
            Annuler
          </button>
          {weeksRemaining > 0 && (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'En cours…' : 'Confirmer la pause'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
