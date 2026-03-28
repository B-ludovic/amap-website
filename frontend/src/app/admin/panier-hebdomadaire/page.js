'use client';

import { useEffect, useState } from "react";
import api from "../../../lib/api";
import logger from "../../../lib/logger";
import { useModal } from "../../../contexts/ModalContext";
import WeeklyBasketModal from "../../../components/admin/WeeklyBasketModal";
import "../../../styles/admin/components.css";
import "../../../styles/admin/dashboard.css";
import "../../../styles/admin/layout.css";
import "../../../styles/admin/weekly-basket.css";
import {
    ShoppingBasket,
    Plus,
    Edit2,
    Trash2,
    Copy,
    Send
} from "lucide-react";

export default function AdminWeeklyBasketPage() {
  const [baskets, setBaskets] = useState([]);
  const [currentBasket, setCurrentBasket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBasket, setSelectedBasket] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  
  const { showSuccess, showError } = useModal();

  useEffect(() => {
    fetchBaskets();
    fetchCurrentBasket();
  }, [filter]);

  const fetchBaskets = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (filter === 'published') {
        params.published = 'true';
      } else if (filter === 'draft') {
        params.published = 'false';
      }
      
      const response = await api.weeklyBaskets.getAll(params);
      setBaskets(response.data);
    } catch (error) {
      showError('Erreur', 'Erreur lors du chargement des paniers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentBasket = async () => {
    try {
      const response = await api.weeklyBaskets.getCurrent();
      setCurrentBasket(response.data);
    } catch (error) {
      logger.error('Erreur current basket:', error);
    }
  };

  const handleCreate = () => {
    setSelectedBasket(null);
    setIsModalOpen(true);
  };

  const handleEdit = (basket) => {
    setSelectedBasket(basket);
    setIsModalOpen(true);
  };

  const handleDelete = async (basketId, isPublished) => {
    const message = isPublished
      ? 'Ce panier est publié et visible par les adhérents. Êtes-vous sûr de vouloir le supprimer ?'
      : 'Êtes-vous sûr de vouloir supprimer ce panier hebdomadaire ?';
    if (!confirm(message)) {
      return;
    }

    try {
      await api.weeklyBaskets.delete(basketId);
      showSuccess('Succès', 'Panier supprimé avec succès');
      fetchBaskets();
      fetchCurrentBasket();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handlePublish = async (basketId) => {
    if (!confirm('Êtes-vous sûr de vouloir publier ce panier ? Les adhérents le verront.')) {
      return;
    }

    try {
      await api.weeklyBaskets.publish(basketId);
      showSuccess('Succès', 'Panier publié avec succès');
      fetchBaskets();
      fetchCurrentBasket();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la publication');
    }
  };

  const handleDuplicate = async (basket) => {
    const weekNumber = prompt('Numéro de semaine (1-52) :');
    const year = prompt('Année :', new Date().getFullYear());
    const distributionDate = prompt('Date de distribution (YYYY-MM-DD) :');

    if (!weekNumber || !year || !distributionDate) return;

    try {
      await api.weeklyBaskets.duplicate(basket.id, {
        weekNumber: parseInt(weekNumber),
        year: parseInt(year),
        distributionDate
      });
      showSuccess('Succès', 'Panier dupliqué avec succès');
      fetchBaskets();
    } catch (error) {
      showError('Erreur', error.response?.data?.message || 'Erreur lors de la duplication');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedBasket(null);
    if (shouldRefresh) {
      fetchBaskets();
      fetchCurrentBasket();
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


  if (loading) {
    return <div className="loading-state">Chargement...</div>;
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Panier hebdomadaire</h1>
          <p className="page-subtitle">Composez le panier de chaque semaine</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={20} />
          Créer un panier
        </button>
      </div>

      {/* Panier en cours */}
      {currentBasket && (
        <div className="current-basket-highlight">
          <div className="current-basket-header">
            <div className="current-basket-badge">
              <ShoppingBasket size={20} />
              <span>Panier en cours</span>
            </div>
            <span className="badge badge-success">Publié</span>
          </div>
          <h3>Semaine {currentBasket.weekNumber} - {currentBasket.year}</h3>
          <p className="current-basket-date">{formatDate(currentBasket.distributionDate)}</p>
          
          <div className="current-basket-summary">
            <div className="current-basket-count">
              <ShoppingBasket size={18} />
              <span>{currentBasket.items.length} produit{currentBasket.items.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          {currentBasket.notes && (
            <div className="current-basket-notes">
              <strong>Message :</strong> {currentBasket.notes}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => handleEdit(currentBasket)}
          >
            <Edit2 size={18} />
            Modifier
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="toolbar">
        <div className="toolbar-filters">
          <button
            className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('upcoming')}
          >
            À venir
          </button>
          <button
            className={`btn ${filter === 'published' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('published')}
          >
            Publiés
          </button>
          <button
            className={`btn ${filter === 'draft' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('draft')}
          >
            Brouillons
          </button>
        </div>
      </div>

      {/* Liste des paniers */}
      {baskets.length === 0 ? (
        <div className="empty-state">
          <ShoppingBasket size={48} />
          <h3>Aucun panier</h3>
          <p>Créez votre premier panier hebdomadaire</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={20} />
            Créer un panier
          </button>
        </div>
      ) : (
        <div className="baskets-grid">
          {baskets.map((basket) => (
            <div key={basket.id} className="basket-card">
              <div className="basket-card-header">
                <div className="basket-info">
                  <h3>Semaine {basket.weekNumber} - {basket.year}</h3>
                  <p className="basket-date">{formatDate(basket.distributionDate)}</p>
                </div>
                {basket.isPublished ? (
                  <span className="badge badge-success">Publié</span>
                ) : (
                  <span className="badge badge-warning">Brouillon</span>
                )}
              </div>

              <div className="basket-card-body">
                <div className="basket-products-count">
                  <ShoppingBasket size={18} />
                  <span>{basket.items.length} produits</span>
                </div>

                {basket.items.length > 0 && (
                  <div className="basket-products-preview">
                    {basket.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="product-preview-item">
                        • {item.product?.name || item.customProductName}
                      </div>
                    ))}
                    {basket.items.length > 3 && (
                      <div className="product-preview-more">
                        +{basket.items.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                )}

                {basket.notes && (
                  <div className="basket-notes">
                    <p>{basket.notes}</p>
                  </div>
                )}
              </div>

              <div className="basket-card-actions">
                <button
                  className="btn btn-icon"
                  onClick={() => handleEdit(basket)}
                  title="Modifier"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  className="btn btn-icon btn-warning"
                  onClick={() => handleDuplicate(basket)}
                  title="Dupliquer"
                >
                  <Copy size={18} />
                </button>
                {!basket.isPublished && basket.items.length > 0 && (
                  <button
                    className="btn btn-success"
                    onClick={() => handlePublish(basket.id)}
                    title="Publier"
                  >
                    <Send size={18} />
                    Publier
                  </button>
                )}
                <button
                  className="btn btn-icon btn-danger"
                  onClick={() => handleDelete(basket.id, basket.isPublished)}
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
        <WeeklyBasketModal
          basket={selectedBasket}
          lastBasket={currentBasket || (baskets.length > 0 ? baskets[0] : null)}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}