'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import ShiftModal from "../../../components/admin/ShiftModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/permanences.css";
import {
    Calendar,
    Users,
    Clock,
    Plus,
    Edit2,
    Trash2,
    Copy
} from "lucide-react";

export default function AdminPermanencesPage() {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);
    const [filter, setFilter] = useState('upcoming');

    const { showSuccess, showError } = useModal();

    useEffect(() => {
        fetchShifts();
    }, [filter]);

    const fetchShifts = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (filter === 'upcoming') {
        params.upcoming = 'true';
      } else if (filter === 'past') {
        params.past = 'true';
      }
      
      const response = await api.shifts.getAll(params);
      setShifts(response.data);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement des permanences');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedShift(null);
    setIsModalOpen(true);
  };

  const handleEdit = (shift) => {
    setSelectedShift(shift);
    setIsModalOpen(true);
  };

  const handleDelete = async (shiftId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette permanence ?')) {
      return;
    }

    try {
      await api.shifts.delete(shiftId);
      showSuccess('Succès', 'Permanence supprimée avec succès');
      fetchShifts();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleDuplicate = async (shift) => {
    const newDate = prompt('Date de la nouvelle permanence (YYYY-MM-DD) :');
    
    if (!newDate) return;

    try {
      await api.shifts.duplicate(shift.id, { newDate });
      showSuccess('Succès', 'Permanence dupliquée avec succès');
      fetchShifts();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la duplication');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedShift(null);
    if (shouldRefresh) {
      fetchShifts();
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (shift) => {
    if (shift.isFull) {
      return <span className="badge badge-success">Complet</span>;
    }
    if (shift.confirmedCount === 0) {
      return <span className="badge badge-error">Aucun bénévole</span>;
    }
    return <span className="badge badge-warning">Places disponibles</span>;
  };

  if (loading) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Gestion des permanences</h1>
          <p className="page-subtitle">Organisez les distributions hebdomadaires</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={20} />
          Créer une permanence
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters">
          <button
            className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('upcoming')}
          >
            À venir
          </button>
          <button
            className={`btn ${filter === 'past' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('past')}
          >
            Passées
          </button>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            Toutes
          </button>
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Aucune permanence</h3>
          <p>Commencez par créer votre première permanence</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={20} />
            Créer une permanence
          </button>
        </div>
      ) : (
        <div className="shifts-grid">
          {shifts.map((shift) => (
            <div key={shift.id} className="shift-card">
              <div className="shift-card-header">
                <div className="shift-date">
                  <Calendar size={20} />
                  <span>{formatDate(shift.distributionDate)}</span>
                </div>
                {getStatusBadge(shift)}
              </div>

              <div className="shift-card-body">
                <div className="shift-info">
                  <Clock size={18} />
                  <span>{shift.startTime} - {shift.endTime}</span>
                </div>

                <div className="shift-volunteers">
                  <Users size={18} />
                  <span>
                    {shift.confirmedCount} / {shift.volunteersNeeded} bénévoles
                  </span>
                </div>

                {shift.volunteers.length > 0 && (
                  <div className="shift-volunteers-list">
                    {shift.volunteers
                      .filter(v => v.status === 'CONFIRMED')
                      .map((volunteer) => (
                        <div key={volunteer.id} className="volunteer-badge">
                          {volunteer.user.firstName} {volunteer.user.lastName}
                          {volunteer.role && <span className="volunteer-role">• {volunteer.role}</span>}
                        </div>
                      ))}
                  </div>
                )}

                {shift.notes && (
                  <div className="shift-notes">
                    <p>{shift.notes}</p>
                  </div>
                )}
              </div>

              <div className="shift-card-actions">
                <button
                  className="btn btn-icon"
                  onClick={() => handleEdit(shift)}
                  title="Modifier"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  className="btn btn-icon"
                  onClick={() => handleDuplicate(shift)}
                  title="Dupliquer"
                >
                  <Copy size={18} />
                </button>
                <button
                  className="btn btn-icon btn-danger"
                  onClick={() => handleDelete(shift.id)}
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <ShiftModal
          shift={selectedShift}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}