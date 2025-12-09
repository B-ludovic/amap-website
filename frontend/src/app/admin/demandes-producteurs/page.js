'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import ProducerInquiryModal from "../../../components/admin/ProducerInquiryModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/requests.css";
import { Sprout, Eye, Check, X, Clock, Archive, MapPin } from "lucide-react";

export default function AdminProducerInquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  
  const { showError } = useModal();

  useEffect(() => {
    fetchInquiries();
  }, [filter]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.producerInquiries.getAll(params);
      setInquiries(response.data.inquiries);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (inquiry) => {
    setSelectedInquiry(inquiry);
    setIsModalOpen(true);
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedInquiry(null);
    if (shouldRefresh) {
      fetchInquiries();
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
      ACCEPTED: { label: 'Acceptée', color: 'success', icon: Check },
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

  if (loading) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Demandes producteurs</h1>
          <p className="page-subtitle">Candidatures pour rejoindre le réseau</p>
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
            className={`btn ${filter === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('ACCEPTED')}
          >
            <Check size={18} />
            Acceptées
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
      {inquiries.length === 0 ? (
        <div className="empty-state">
          <Sprout size={48} />
          <h3>Aucune demande</h3>
          <p>
            {filter === 'PENDING' 
              ? 'Aucune demande de producteur en attente'
              : 'Aucune demande ne correspond à ce filtre'}
          </p>
        </div>
      ) : (
        <div className="requests-grid">
          {inquiries.map((inquiry) => (
            <div key={inquiry.id} className="request-card">
              <div className="request-card-header">
                <div className="request-info">
                  <h3>{inquiry.farmName}</h3>
                  <p className="request-subtitle">
                    {inquiry.firstName} {inquiry.lastName}
                  </p>
                  <p className="request-date">
                    Demande reçue le {formatDate(inquiry.createdAt)}
                  </p>
                </div>
                {getStatusBadge(inquiry.status)}
              </div>

              <div className="request-card-body">
                <div className="request-contact">
                  <div className="contact-item">
                    <span className="contact-label">Email :</span>
                    <span className="contact-value">{inquiry.email}</span>
                  </div>
                  <div className="contact-item">
                    <span className="contact-label">Téléphone :</span>
                    <span className="contact-value">{inquiry.phone}</span>
                  </div>
                </div>

                <div className="producer-location">
                  <MapPin size={16} />
                  <span>
                    {inquiry.city} ({inquiry.postalCode})
                    {inquiry.distance && ` • ${inquiry.distance} km`}
                  </span>
                </div>

                <div className="producer-details">
                  <div className="detail-item">
                    <span className="detail-label">Production :</span>
                    <span className="detail-value">{inquiry.products}</span>
                  </div>
                  {inquiry.isBio && (
                    <div className="bio-badge">
                      <Sprout size={14} />
                      <span>Agriculture biologique</span>
                    </div>
                  )}
                  {inquiry.certifications && (
                    <div className="certifications">
                      <span className="detail-label">Certifications :</span>
                      <span className="detail-value">{inquiry.certifications}</span>
                    </div>
                  )}
                </div>

                {inquiry.message && (
                  <div className="request-message">
                    <strong>Message :</strong>
                    <p>{inquiry.message.substring(0, 100)}{inquiry.message.length > 100 ? '...' : ''}</p>
                  </div>
                )}

                {inquiry.adminNotes && (
                  <div className="request-admin-notes">
                    <strong>Notes admin :</strong>
                    <p>{inquiry.adminNotes}</p>
                  </div>
                )}
              </div>

              <div className="request-card-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleView(inquiry)}
                >
                  <Eye size={18} />
                  Voir détails
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && selectedInquiry && (
        <ProducerInquiryModal
          inquiry={selectedInquiry}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}