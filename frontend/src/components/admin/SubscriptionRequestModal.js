'use client';

import { useState } from 'react';
import { X, User, Mail, Phone, ShoppingBasket, MessageSquare, Check, X as XIcon, FileText, Download } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import api from '../../lib/api';
import '../../styles/admin/components.css';

export default function SubscriptionRequestModal({ request, onClose }) {
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || '');
  const [loading, setLoading] = useState(false);
  const [downloadingContract, setDownloadingContract] = useState(false);
  
  const { showSuccess, showError, showConfirm } = useModal();

  const handleUpdateStatus = async (newStatus) => {
    try {
      setLoading(true);
      
      await api.subscriptionRequests.updateStatus(request.id, {
        status: newStatus,
        adminNotes
      });

      showSuccess('Succès', 'Statut mis à jour avec succès');
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

  const handleApprove = () => {
    showConfirm(
      'Créer l\'abonnement',
      'Créer l\'abonnement pour cet adhérent ? Assurez-vous que le paiement a bien été reçu.',
      async () => {
        try {
          setLoading(true);
          await api.subscriptionRequests.approve(request.id, adminNotes);
          showSuccess('Succès', 'Abonnement créé avec succès !');
          onClose(true);
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleDownloadContract = async () => {
    try {
      setDownloadingContract(true);
      await api.subscriptionRequests.downloadContract(request.id);
      showSuccess('Succès', 'Contrat téléchargé avec succès');
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setDownloadingContract(false);
    }
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
          <h2>Demande d'abonnement</h2>
          <button className="modal-close" onClick={() => onClose(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Informations personnelles */}
          <div className="detail-section">
            <h3>
              <User size={20} />
              Informations personnelles
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Nom complet</span>
                <span className="detail-value">
                  {request.firstName} {request.lastName}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{request.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Téléphone</span>
                <span className="detail-value">{request.phone}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date de demande</span>
                <span className="detail-value">{formatDate(request.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Abonnement souhaité */}
          <div className="detail-section">
            <h3>
              <ShoppingBasket size={20} />
              Abonnement souhaité
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Type</span>
                <span className="detail-value">
                  {request.type === 'ANNUAL' ? 'Abonnement Annuel' : 'Abonnement Découverte (3 mois)'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Taille de panier</span>
                <span className="detail-value">
                  {request.basketSize === 'SMALL' ? 'Petit panier (2-4 kg)' : 'Grand panier (6-8 kg)'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tarification</span>
                <span className="detail-value">
                  {request.pricingType === 'NORMAL' ? 'Tarif normal (100%)' : 'Tarif solidaire (20%)'}
                </span>
              </div>
            </div>
          </div>

          {/* Message */}
          {request.message && (
            <div className="detail-section">
              <h3>
                <MessageSquare size={20} />
                Message
              </h3>
              <div className="message-box">
                {request.message}
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
              placeholder="Notes internes (paiement reçu, remarques, etc.)"
              className="admin-notes-textarea"
            />
          </div>

          {/* Statut actuel */}
          <div className="detail-section">
            <h3>Statut actuel</h3>
            <div className="current-status">
              {request.status === 'PENDING' && (
                <span className="badge badge-warning">En attente de traitement</span>
              )}
              {request.status === 'IN_PROGRESS' && (
                <span className="badge badge-info">En cours de traitement</span>
              )}
              {request.status === 'APPROVED' && (
                <span className="badge badge-success">Approuvée - Abonnement créé</span>
              )}
              {request.status === 'REJECTED' && (
                <span className="badge badge-error">Refusée</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onClose(false)}
            disabled={loading || downloadingContract}
          >
            Fermer
          </button>

          {/* Bouton télécharger contrat (si approuvé) */}
          {request.status === 'APPROVED' && (
            <button
              type="button"
              className="btn btn-info"
              onClick={handleDownloadContract}
              disabled={downloadingContract || loading}
            >
              <Download size={18} />
              {downloadingContract ? 'Génération...' : 'Télécharger le contrat'}
            </button>
          )}

          {/* Boutons d'action selon le statut */}
          {request.status === 'PENDING' && (
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
                onClick={handleApprove}
                disabled={loading}
              >
                <Check size={18} />
                {loading ? 'Création...' : 'Approuver et créer l\'abonnement'}
              </button>
            </>
          )}

          {request.status === 'IN_PROGRESS' && (
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
                onClick={handleApprove}
                disabled={loading}
              >
                <Check size={18} />
                {loading ? 'Création...' : 'Approuver et créer l\'abonnement'}
              </button>
            </>
          )}

          {(request.status === 'APPROVED' || request.status === 'REJECTED') && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleUpdateStatus(request.status)}
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