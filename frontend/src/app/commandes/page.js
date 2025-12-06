'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { orders as ordersApi } from '../lib/api';

function CommandesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      router.push('/auth/login');
    }
  }, [user, router]);

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.getMy();
      setOrders(data.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'En attente', class: 'badge-warning' },
      PAID: { label: 'Payé', class: 'badge-success' },
      PREPARING: { label: 'En préparation', class: 'badge-primary' },
      READY: { label: 'Prêt', class: 'badge-success' },
      COMPLETED: { label: 'Récupéré', class: 'badge-success' },
      CANCELLED: { label: 'Annulé', class: 'badge-error' },
      REFUNDED: { label: 'Remboursé', class: 'badge-error' }
    };

    const config = statusConfig[status] || { label: status, class: 'badge-primary' };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="commandes-page">
        <div className="container">
          <p className="text-center">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="commandes-page">
      <div className="container">
        <div className="page-header">
          <div>
            <Link href="/compte" className="back-link">
              <ArrowLeft size={20} /> Retour au compte
            </Link>
            <h1 className="page-title">Mes Commandes</h1>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <p>Vous n&apos;avez pas encore passé de commande.</p>
            <Link href="/paniers" className="btn btn-primary mt-lg">
              Découvrir nos paniers
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <h3 className="order-card-number">
                      Commande #{order.orderNumber}
                    </h3>
                    <p className="order-card-date">
                      Passée le {formatDate(order.createdAt)}
                    </p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="order-card-body">
                  <div className="order-items">
                    {order.orderItems.map((item, index) => (
                      <div key={index} className="order-item">
                        <span className="order-item-quantity">{item.quantity}x</span>
                        <span className="order-item-name">
                          {item.basketAvailability.basketType.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="order-details">
                    <div className="order-detail">
                      <MapPin size={18} className="order-detail-icon" />
                      <span className="order-detail-label">Retrait :</span>
                      <span className="order-detail-value">
                        {order.pickupLocation.name}
                      </span>
                    </div>
                    <div className="order-detail">
                      <Calendar size={18} className="order-detail-icon" />
                      <span className="order-detail-label">Date de retrait :</span>
                      <span className="order-detail-value">
                        {formatDate(order.pickupDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="order-card-footer">
                  <span className="order-total">
                    Total : {order.totalAmount.toFixed(2)}€
                  </span>
                  <Link href={`/compte/commandes/${order.id}`} className="btn btn-outline btn-sm">
                    Voir détails
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandesPage;