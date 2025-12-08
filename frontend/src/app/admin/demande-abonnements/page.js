'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import SubscriptionDetailModal from "../../../components/admin/SubscriptionDetailModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/request.css";
import { UserPlus, Eye, Check, X, Clock, Archive } from "lucide-react";

export default function AdminSubscriptionRequestsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [filter, setFilter] = useState('PENDING');

    const { showModal } = useModal();

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.subscriptionRequests.getAll(params);
      setRequests(response.data.requests);
    } catch (error) {
      showModal('Erreur lors du chargement des demandes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (request) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedRequest(null);
    if (shouldRefresh) {
      fetchRequests();
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

  const getStatusBadge = (status) => {
    const statuses = {
      PENDING: { label: 'En attente', color: 'warning', icon: Clock },
      IN_PROGRESS: { label: 'En cours', color: 'info', icon: Clock },
      APPROVED: { label: 'Approuvée', color: 'success', icon: Check },
      REJECTED: { label: 'Refusée', color: 'error', icon: X },
      ARCHIVED: { label: 'Archivée', color: 'secondary', icon: Archive }
    };
    
    const info = statuses[status] || statuses.PENDING;
    const Icon = info.icon;
    
    return (
      <span className={`badge badge-${info.color}`}>
        <Icon size={14} />
        {info.label}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    return type === 'ANNUAL' ? (
      <span className="badge badge-primary">Annuel</span>
    ) : (
      <span className="badge badge-info">Découverte</span>
    );
  };

  const getBasketSizeBadge = (size) => {
    return size === 'SMALL' ? (
      <span className="basket-badge basket-small">Petit panier (2-4 kg)</span>
    ) : (
      <span className="basket-badge basket-large">Grand panier (6-8 kg)</span>
    );
  };

  const getPricingBadge = (pricingType) => {
    return pricingType === 'SOLIDARITY' ? (
      <span className="badge badge-warning">Tarif solidaire</span>
    ) : (
      <span className="badge">Tarif normal</span>
    );
  };

  if (loading) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Demandes d'abonnements</h1>
          <p className="page-subtitle">Gérez les demandes d'inscription</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <button
            className={`btn ${filter === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('PENDING')}
          >
            <Clock size={18} />
            En attente
          </button>
          <button
            className={`btn ${filter === 'IN_PROGRESS' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('IN_PROGRESS')}
          >
            En cours
          </button>
          <button
            className={`btn ${filter === 'APPROVED' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('APPROVED')}
          >
            <Check size={18} />
            Approuvées
          </button>
          <button
            className={`btn ${filter === 'REJECTED' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('REJECTED')}
          >
            <X size={18} />
            Refusées
          </button>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            Toutes
          </button>
        </div>
      </div>

      {/* Liste des demandes */}
      {requests.length === 0 ? (
        <div className="empty-state">
          <UserPlus size={48} />
          <h3>Aucune demande</h3>
          <p>
            {filter === 'PENDING' 
              ? 'Aucune demande en attente de traitement'
              : 'Aucune demande ne correspond à ce filtre'}
          </p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-card-header">
                <div className="request-info">
                  <h3>{request.firstName} {request.lastName}</h3>
                  <p className="request-date">
                    Demande reçue le {formatDate(request.createdAt)}
                  </p>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className="request-card-body">
                <div className="request-contact">
                  <div className="contact-item">
                    <span className="contact-label">Email :</span>
                    <span className="contact-value">{request.email}</span>
                  </div>
                  <div className="contact-item">
                    <span className="contact-label">Téléphone :</span>
                    <span className="contact-value">{request.phone}</span>
                  </div>
                </div>

                <div className="request-details">
                  <div className="detail-badges">
                    {getTypeBadge(request.type)}
                    {getBasketSizeBadge(request.basketSize)}
                    {getPricingBadge(request.pricingType)}
                  </div>
                </div>

                {request.message && (
                  <div className="request-message">
                    <strong>Message :</strong>
                    <p>{request.message.substring(0, 100)}{request.message.length > 100 ? '...' : ''}</p>
                  </div>
                )}

                {request.adminNotes && (
                  <div className="request-admin-notes">
                    <strong>Notes admin :</strong>
                    <p>{request.adminNotes}</p>
                  </div>
                )}
              </div>

              <div className="request-card-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleView(request)}
                >
                  <Eye size={18} />
                  Voir détails
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && selectedRequest && (
        <SubscriptionRequestModal
          request={selectedRequest}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
