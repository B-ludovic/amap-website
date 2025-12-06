'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import ProductModal from "../../../components/admin/ProductModal";

export default function AdminProductsPage() {
  const router = useRouter();
  const { showConfirm, showSuccess, showError } = useModal();
  
  const [products, setProducts] = useState([]);
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducer, setSelectedProducer] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, producersRes] = await Promise.all([
        api.admin.products.getAll(),
        api.admin.producers.getAll()
      ]);
      setProducts(productsRes.data);
      setProducers(producersRes.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = (product) => {
    showConfirm(
      'Supprimer le produit',
      `Êtes-vous sûr de vouloir supprimer "${product.name}" ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.products.delete(product.id);
          showSuccess('Produit supprimé', `${product.name} a été supprimé avec succès.`);
          fetchData();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    if (shouldRefresh) {
      fetchData();
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.producer?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProducer = !selectedProducer || product.producerId === selectedProducer;
    
    return matchesSearch && matchesProducer;
  });

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <p>Chargement des produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Produits</h1>
          <p className="admin-page-description">
            Gérez le catalogue de produits
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus size={20} />
          Ajouter un produit
        </button>
      </div>

      <div className="admin-page-content">
        {/* Barre de recherche et filtres */}
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-search-input"
            />
          </div>

          <div className="admin-filters">
            <Filter size={20} />
            <select
              value={selectedProducer}
              onChange={(e) => setSelectedProducer(e.target.value)}
              className="admin-filter-select"
            >
              <option value="">Tous les producteurs</option>
              {producers.map(producer => (
                <option key={producer.id} value={producer.id}>
                  {producer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-toolbar-info">
            {filteredProducts.length} produit(s)
          </div>
        </div>

        {/* Tableau */}
        {filteredProducts.length > 0 ? (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Producteur</th>
                  <th>Unité</th>
                  <th>Origine</th>
                  <th>Type</th>
                  <th className="admin-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-table-name">
                        {product.name}
                        {product.isExample && (
                          <span className="badge badge-warning badge-sm">Exemple</span>
                        )}
                      </div>
                    </td>
                    <td>{product.producer?.name || '-'}</td>
                    <td>
                      <span className="admin-unit-badge">
                        {product.unit}
                      </span>
                    </td>
                    <td>{product.origin || '-'}</td>
                    <td>
                      {product.isExample ? (
                        <span className="badge badge-warning">Exemple</span>
                      ) : (
                        <span className="badge badge-success">Réel</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          onClick={() => handleEdit(product)}
                          className="admin-action-btn admin-action-edit"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
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
            <p>Aucun produit trouvé</p>
            {(searchTerm || selectedProducer) && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedProducer('');
                }}
                className="btn btn-outline btn-sm"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {isModalOpen && (
        <ProductModal
          product={selectedProduct}
          producers={producers}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}