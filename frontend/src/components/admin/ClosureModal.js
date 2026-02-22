'use client';

import { useState } from 'react';
import { X, DoorClosed, AlertTriangle, Mail } from 'lucide-react';
import api from '../../lib/api';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateFR(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

export default function ClosureModal({ daysUsed, daysRemaining, onClose }) {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 7));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const daysRequested = Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
  const isExhausted = daysRemaining === 0;
  const wouldExceed = daysRequested > daysRemaining;

  async function handleConfirm() {
    setError('');
    if (new Date(endDate) <= new Date(startDate)) {
      setError('La date de fin doit être après la date de début.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.closures.create({ startDate, endDate, reason: reason || undefined });
      onClose(true, result.data?.sentCount ?? 0);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <DoorClosed size={20} />
            <h2 className="modal-title">Créer une fermeture AMAP</h2>
          </div>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Info newsletter */}
          <div className="closure-modal-info">
            <Mail size={16} />
            <span>Une newsletter sera automatiquement envoyée à tous les abonnés actifs lors de la création.</span>
          </div>

          {isExhausted ? (
            <div className="closure-quota-exhausted">
              <AlertTriangle size={32} />
              <p>La limite de 3 semaines de fermeture pour cette année est atteinte.</p>
            </div>
          ) : (
            <>
              {/* Quota restant */}
              <div className="pause-weeks-counter" style={{ marginBottom: 'var(--spacing-md)' }}>
                <span>Jours de fermeture utilisés cette année :</span>
                <strong>{daysUsed} / 21</strong>
              </div>

              {/* Date début */}
              <div className="form-group">
                <label className="form-label">Date de début</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {/* Date fin */}
              <div className="form-group">
                <label className="form-label">Date de fin</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  min={addDays(startDate, 1)}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>

              {/* Durée calculée */}
              {daysRequested > 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                  Durée : {daysRequested} jour{daysRequested > 1 ? 's' : ''}
                  {wouldExceed && (
                    <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                      — dépasse le quota restant ({daysRemaining} j)
                    </span>
                  )}
                </p>
              )}

              {/* Raison */}
              <div className="form-group">
                <label className="form-label">Motif <span className="form-optional">(optionnel)</span></label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex : congés estivaux, travaux…"
                />
              </div>

              {/* Avertissement */}
              <div className="closure-modal-warning">
                <AlertTriangle size={16} />
                <div>
                  <strong>Êtes-vous sûr ?</strong> Aucune distribution ne sera effectuée du{' '}
                  <strong>{formatDateFR(startDate)}</strong> au <strong>{formatDateFR(endDate)}</strong>.
                  Un email sera envoyé à tous les abonnés actifs.
                </div>
              </div>

              {error && (
                <div className="closure-modal-error">
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
          {!isExhausted && (
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={loading || wouldExceed}
            >
              {loading ? 'Création…' : 'Créer la fermeture'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
