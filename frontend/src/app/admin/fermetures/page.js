'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import ClosureModal from '../../../components/admin/ClosureModal';
import '../../../styles/admin/components.css';
import '../../../styles/admin/layout.css';
import '../../../styles/admin/fermetures.css';
import { DoorClosed, Plus, Trash2, AlertTriangle } from 'lucide-react';

function formatDateFR(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function getClosureTag(startDate, endDate) {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < now) return { label: 'Passée', className: 'past' };
  if (start <= now) return { label: 'En cours', className: 'ongoing' };
  return { label: 'À venir', className: 'future' };
}

function daysBetween(startDate, endDate) {
  return Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
}

export default function AdminFermeturesPage() {
  const [closures, setClosures] = useState([]);
  const [daysUsed, setDaysUsed] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(21);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showSuccess, showError, showConfirm } = useModal();

  useEffect(() => {
    fetchClosures();
  }, []);

  const fetchClosures = async () => {
    try {
      setLoading(true);
      const response = await api.closures.getAll();
      setClosures(response.data.closures);
      setDaysUsed(response.data.daysUsedThisYear);
      setDaysRemaining(response.data.daysRemainingThisYear);
    } catch {
      showError('Erreur', 'Impossible de charger les fermetures');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = (shouldRefresh, sentCount) => {
    setIsModalOpen(false);
    if (shouldRefresh) {
      showSuccess('Fermeture créée', `Newsletter envoyée à ${sentCount} abonné(s).`);
      fetchClosures();
    }
  };

  const handleDelete = (closure) => {
    showConfirm(
      'Supprimer la fermeture',
      `Supprimer la fermeture du ${formatDateFR(closure.startDate)} au ${formatDateFR(closure.endDate)} ?`,
      async () => {
        try {
          await api.closures.delete(closure.id);
          showSuccess('Succès', 'Fermeture supprimée');
          fetchClosures();
        } catch (err) {
          showError('Erreur', err.response?.data?.message || 'Erreur lors de la suppression');
        }
      }
    );
  };

  const isFuture = (closure) => new Date(closure.startDate) > new Date();

  const percentUsed = Math.min(100, Math.round((daysUsed / 21) * 100));

  return (
    <div className="admin-page">
      {/* En-tête */}
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-title-group">
            <DoorClosed size={24} className="page-title-icon" />
            <div>
              <h1 className="page-title">Fermetures AMAP</h1>
              <p className="page-subtitle">
                Gérez les semaines de fermeture (max 3 semaines / 21 jours par an).
                Une newsletter est envoyée automatiquement aux abonnés actifs.
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
            disabled={daysRemaining === 0}
          >
            <Plus size={16} />
            Nouvelle fermeture
          </button>
        </div>
      </div>

      {/* Quota annuel */}
      <div className="closure-quota">
        <span className="closure-quota-label">
          Quota {new Date().getFullYear()} : <strong>{daysUsed} / 21 jours</strong>
        </span>
        <div className="closure-quota-bar-wrap">
          <div
            className={`closure-quota-bar${daysUsed >= 21 ? ' full' : ''}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <span className="closure-quota-label">
          {daysRemaining > 0
            ? <><strong>{daysRemaining}</strong> jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</>
            : <span className="closure-quota-exceeded">Quota atteint</span>
          }
        </span>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="loading-state">Chargement…</div>
      ) : closures.length === 0 ? (
        <div className="empty-state">
          <DoorClosed size={48} />
          <h3>Aucune fermeture</h3>
          <p>Créez une fermeture pour informer automatiquement les abonnés.</p>
        </div>
      ) : (
        <div className="closures-list">
          {closures.map(closure => {
            const tag = getClosureTag(closure.startDate, closure.endDate);
            const days = daysBetween(closure.startDate, closure.endDate);
            return (
              <div key={closure.id} className={`closure-card${tag.className === 'past' ? ' past' : ''}`}>
                <div className="closure-card-icon">
                  <DoorClosed size={18} />
                </div>
                <div className="closure-card-body">
                  <div className="closure-card-dates">
                    {formatDateFR(closure.startDate)} → {formatDateFR(closure.endDate)}
                  </div>
                  <div className="closure-card-meta">
                    <span className="closure-card-duration">{days} jour{days > 1 ? 's' : ''}</span>
                    {closure.reason && (
                      <span className="closure-card-reason">{closure.reason}</span>
                    )}
                    <span className={`closure-card-tag ${tag.className}`}>{tag.label}</span>
                  </div>
                </div>
                {isFuture(closure) && (
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={() => handleDelete(closure)}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Avertissement quota atteint */}
      {daysRemaining === 0 && (
        <div className="closure-modal-warning closure-quota-warning">
          <AlertTriangle size={16} />
          <span>
            Le quota de 3 semaines de fermeture pour {new Date().getFullYear()} est atteint.
            Il ne sera pas possible de créer de nouvelles fermetures cette année.
          </span>
        </div>
      )}

      {isModalOpen && (
        <ClosureModal
          daysUsed={daysUsed}
          daysRemaining={daysRemaining}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
