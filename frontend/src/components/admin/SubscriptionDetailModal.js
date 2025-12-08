'use client';

import { X, User, CreditCard, Calendar, MapPin, Package, CheckCircle } from 'lucide-react';
import '../../styles/admin/components.css';

export default function SubscriptionDetailModal({ subscription, onClose, onUpdate }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statuses = {
      PENDING: { label: 'En attente', color: 'warning' },
      ACTIVE: { label: 'Actif', color: 'success' },
      PAUSED: { label: 'En pause', color: 'secondary' },
      EXPIRED: { label: 'Expiré', color: 'error' },
      CANCELLED: { label: 'Annulé', color: 'error' }
    };
    
    const info = statuses[status] || statuses.PENDING;
    return <span className={`badge badge-${info.color}`}>{info.label}</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Détails de l'abonnement</h2>
            <p className="modal-subtitle">{subscription.subscriptionNumber}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* Informations adhérent */}
          <div className="detail-section">
            <h3>
              <User size={20} />
              Adhérent
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Nom</span>
                <span className="detail-value">
                  {subscription.user.firstName} {subscription.user.lastName}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email</span>
                <span className="detail-value">{subscription.user.email}</span>
              </div>
              {subscription.user.phone && (
                <div className="detail-item">
                  <span className="detail-label">Téléphone</span>
                  <span className="detail-value">{subscription.user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Abonnement */}
          <div className="detail-section">
            <h3>
              <CreditCard size={20} />
              Abonnement
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Type</span>
                <span className="detail-value">
                  {subscription.type === 'ANNUAL' ? 'Annuel' : 'Découverte (3 mois)'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Panier</span>
                <span className="detail-value">
                  {subscription.basketSize === 'SMALL' ? 'Petit (2-4 kg)' : 'Grand (6-8 kg)'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tarification</span>
                <span className="detail-value">
                  {subscription.pricingType === 'NORMAL' ? 'Normal (100%)' : 'Solidaire (20%)'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Statut</span>
                <span className="detail-value">
                  {getStatusBadge(subscription.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Période */}
          <div className="detail-section">
            <h3>
              <Calendar size={20} />
              Période
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Date de début</span>
                <span className="detail-value">{formatDate(subscription.startDate)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date de fin</span>
                <span className="detail-value">{formatDate(subscription.endDate)}</span>
              </div>
            </div>
          </div>

          {/* Point de retrait */}
          <div className="detail-section">
            <h3>
              <MapPin size={20} />
              Point de retrait
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Nom</span>
                <span className="detail-value">{subscription.pickupLocation.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Adresse</span>
                <span className="detail-value">
                  {subscription.pickupLocation.address}, {subscription.pickupLocation.postalCode} {subscription.pickupLocation.city}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Horaires</span>
                <span className="detail-value">{subscription.pickupLocation.schedule}</span>
              </div>
            </div>
          </div>

          {/* Paiement */}
          <div className="detail-section">
            <h3>
              <Package size={20} />
              Paiement
            </h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Prix</span>
                <span className="detail-value">{subscription.price.toFixed(2)} €</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Montant payé</span>
                <span className="detail-value">{subscription.paidAmount.toFixed(2)} €</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Reste à payer</span>
                <span className="detail-value">
                  {(subscription.price - subscription.paidAmount).toFixed(2)} €
                </span>
              </div>
            </div>
          </div>

          {/* Pauses */}
          {subscription.pauses && subscription.pauses.length > 0 && (
            <div className="detail-section">
              <h3>Pauses</h3>
              <div className="pauses-list">
                {subscription.pauses.map((pause) => (
                  <div key={pause.id} className="pause-item">
                    <Calendar size={16} />
                    <span>
                      Du {formatDate(pause.startDate)} au {formatDate(pause.endDate)}
                    </span>
                    {pause.reason && <span className="pause-reason">• {pause.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historique des retraits */}
          {subscription.pickups && subscription.pickups.length > 0 && (
            <div className="detail-section">
              <h3>
                <CheckCircle size={20} />
                Derniers retraits ({subscription.pickups.length})
              </h3>
              <div className="pickups-list">
                {subscription.pickups.map((pickup) => (
                  <div key={pickup.id} className="pickup-item">
                    <div className="pickup-date">
                      <Calendar size={16} />
                      <span>
                        Semaine {pickup.weeklyBasket.weekNumber} - {formatDate(pickup.weeklyBasket.distributionDate)}
                      </span>
                    </div>
                    {pickup.wasPickedUp ? (
                      <span className="badge badge-success">
                        <CheckCircle size={14} />
                        Récupéré
                      </span>
                    ) : (
                      <span className="badge badge-warning">Non récupéré</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}