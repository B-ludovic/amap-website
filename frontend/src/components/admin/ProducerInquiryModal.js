'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, MapPin, Package, MessageSquare, Check, X as XIcon, FileText, Sprout } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import '../../styles/admin/components.css';

export default function ProducerInquiryModal({ inquiry, onClose }) {
  const [adminNotes, setAdminNotes] = useState(inquiry.adminNotes || '');
  const [loading, setLoading] = useState(false);
  
  const { showSuccess, showError } = useModal();

  const handleUpdateStatus = async (newStatus, createProducer = false) => {
    try {
      setLoading(true);
      
      const response = await api.producerInquiries.updateStatus(inquiry.id, {
        status: newStatus,
        adminNotes,
        createProducer
      });

      if (createProducer && response.data.producer) {
        showSuccess('Succès', 'Producteur créé avec succès !');
      } else {
        showSuccess('Succès', 'Statut mis à jour avec succès');
      }

      onClose(true);
    } catch (error) {
      showError(
        'Erreur',
        error.response?.data?.message || 'Erreur lors de la mise à jour'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAndCreate = async () => {
    if (!confirm('Accepter cette demande et créer le producteur ?')) {
      return;
    }

    await handleUpdateStatus('ACCEPTED', true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Demande de producteur</h2>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Informations exploitation */}
          <div className="detail-section">
            <h3>
              <Sprout size={20} />
              Exploitation
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Nom de l'exploitation</span>
                <span className="detail-value">{inquiry.farmName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Responsable</span>
                <span className="detail-value">
                  {inquiry.firstName} {inquiry.lastName}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date de demande</span>
                <span className="detail-value">{formatDate(inquiry.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="detail-section">
            <h3>
              <Mail size={20} />
              Contact
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{inquiry.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Téléphone</span>
                <span className="detail-value">{inquiry.phone}</span>
              </div>
              {inquiry.availability && (
                <div className="detail-item">
                  <span className="detail-label">Disponibilité</span>
                  <span className="detail-value">{inquiry.availability}</span>
                </div>
              )}
            </div>
          </div>

          {/* Localisation */}
          <div className="detail-section">
            <h3>
              <MapPin size={20} />
              Localisation
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Adresse</span>
                <span className="detail-value">{inquiry.address}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ville</span>
                <span className="detail-value">
                  {inquiry.city} ({inquiry.postalCode})
                </span>
              </div>
              {inquiry.distance && (
                <div className="detail-item">
                  <span className="detail-label">Distance du point de retrait</span>
                  <span className="detail-value">{inquiry.distance} km</span>
                </div>
              )}
            </div>
          </div>

          {/* Production */}
          <div className="detail-section">
            <h3>
              <Package size={20} />
              Production
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Types de produits</span>
                <span className="detail-value">{inquiry.products}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Agriculture biologique</span>
                <span className="detail-value">
                  {inquiry.isBio ? (
                    <span className="badge badge-success">
                      <Sprout size={14} />
                      Oui
                    </span>
                  ) : (
                    <span className="badge badge-secondary">Non</span>
                  )}
                </span>
              </div>
              {inquiry.certifications && (
                <div className="detail-item">
                  <span className="detail-label">Certifications</span>
                  <span className="detail-value">{inquiry.certifications}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message */}
          {inquiry.message && (
            <div className="detail-section">
              <h3>
                <MessageSquare size={20} />
                Message
              </h3>
              <div className="message-box">
                {inquiry.message}
              </div>
            </div>
          )}

          {/* Notes administratives */}
          <div className="detail-section">
            <h3>
              <FileText size={20} />
              Notes administratives
            </h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows="4"
              placeholder="Notes internes (visite prévue, remarques, conditions d'acceptation...)"
              className="admin-notes-textarea"
            />
          </div>

          {/* Statut actuel */}
          <div className="detail-section">
            <h3>Statut actuel</h3>
            <div className="current-status">
              {inquiry.status === 'PENDING' && (
                <span className="badge badge-warning">En attente de traitement</span>
              )}
              {inquiry.status === 'IN_PROGRESS' && (
                <span className="badge badge-info">En cours d'évaluation</span>
              )}
              {inquiry.status === 'ACCEPTED' && (
                <span className="badge badge-success">Acceptée - Producteur créé</span>
              )}
              {inquiry.status === 'REJECTED' && (
                <span className="badge badge-error">Refusée</span>
              )}
              {inquiry.status === 'ARCHIVED' && (
                <span className="badge badge-secondary">Archivée</span>
              )}
            </div>
          </div>

          {/* Réponse envoyée */}
          {inquiry.respondedAt && (
            <div className="info-box">
              <strong>Réponse envoyée :</strong>
              <p>Le {formatDate(inquiry.respondedAt)}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onClose(false)}
            disabled={loading}
          >
            Fermer
          </button>

          {inquiry.status === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => handleUpdateStatus('IN_PROGRESS')}
                disabled={loading}
              >
                Marquer en cours
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleUpdateStatus('REJECTED')}
                disabled={loading}
              >
                <XIcon size={18} />
                Refuser
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleAcceptAndCreate}
                disabled={loading}
              >
                <Check size={18} />
                {loading ? 'Création...' : 'Accepter et créer le producteur'}
              </button>
            </>
          )}

          {inquiry.status === 'IN_PROGRESS' && (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleUpdateStatus('REJECTED')}
                disabled={loading}
              >
                <XIcon size={18} />
                Refuser
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleAcceptAndCreate}
                disabled={loading}
              >
                <Check size={18} />
                {loading ? 'Création...' : 'Accepter et créer le producteur'}
              </button>
            </>
          )}

          {(inquiry.status !== 'PENDING' && inquiry.status !== 'IN_PROGRESS') && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleUpdateStatus(inquiry.status)}
              disabled={loading}
            >
              {loading ? 'Enregistrement...' : 'Enregistrer les notes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}