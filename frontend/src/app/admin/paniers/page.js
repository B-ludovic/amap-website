'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BasketModal from "../../../components/admin/BasketModal";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import { Plus, Search, Edit, Trash2 } from "lucide-react";

export default function AdminBasketsPage() {
  const router = useRouter();
  const { showConfirm, showSuccess, showError } = useModal();
  
  const [baskets, setBaskets] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBasket, setSelectedBasket] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [basketsRes, productsRes] = await Promise.all([
        api.admin.baskets.getAll(),
        api.admin.products.getAll()
      ]);
      setBaskets(basketsRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les données.');
    } finally {
      setLoading(false);
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

  const handleDelete = (basket) => {
    showConfirm(
      'Supprimer le panier',
      `Êtes-vous sûr de vouloir supprimer "${basket.name}" ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.baskets.delete(basket.id);
          showSuccess('Panier supprimé', `${basket.name} a été supprimé avec succès.`);
          fetchData();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedBasket(null);
    if (shouldRefresh) {
      fetchData();
    }
  };

  const filteredBaskets = baskets.filter(basket =>
    basket.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    basket.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <p>Chargement des paniers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Paniers</h1>
          <p className="admin-page-description">
            Gérez les types de paniers et leur composition
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus size={20} />
          Ajouter un panier
        </button>
      </div>

      <div className="admin-page-content">
        {/* Barre de recherche */}
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Rechercher un panier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-search-input"
            />
          </div>
          <div className="admin-toolbar-info">
            {filteredBaskets.length} panier(s)
          </div>
        </div>

        {/* Tableau */}
        {filteredBaskets.length > 0 ? (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prix</th>
                  <th>Produits</th>
                  <th>Statut</th>
                  <th>Type</th>
                  <th className="admin-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBaskets.map((basket) => (
                  <tr key={basket.id}>
                    <td>
                      <div className="admin-table-name">
                        {basket.name}
                        {basket.isExample && (
                          <span className="badge badge-warning badge-sm">Exemple</span>
                        )}
                      </div>
                    </td>
                    <td className="admin-table-amount">
                      {parseFloat(basket.price).toFixed(2)} €
                    </td>
                    <td>
                      <span className="admin-product-count">
                        {basket.products?.length || 0} produit(s)
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status-badge ${basket.isActive ? 'admin-status-active' : 'admin-status-inactive'}`}>
                        {basket.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      {basket.isExample ? (
                        <span className="badge badge-warning">Exemple</span>
                      ) : (
                        <span className="badge badge-success">Réel</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          onClick={() => handleEdit(basket)}
                          className="admin-action-btn admin-action-edit"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(basket)}
                          className="admin-action-btn admin-action-delete"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty-state">
            <p>Aucun panier trouvé</p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="btn btn-outline btn-sm"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {isModalOpen && (
        <BasketModal
          basket={selectedBasket}
          products={products}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}