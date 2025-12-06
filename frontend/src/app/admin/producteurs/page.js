'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import ProducerModal from "../../../components/admin/ProducerModal";




export default function AdminProducersPage() {
  const router = useRouter();
  const { showConfirm, showSuccess, showError } = useModal();
  
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState(null);

  useEffect(() => {
    fetchProducers();
  }, []);

  const fetchProducers = async () => {
    setLoading(true);
    try {
      const response = await api.admin.producers.getAll();
      setProducers(response.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les producteurs.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedProducer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (producer) => {
    setSelectedProducer(producer);
    setIsModalOpen(true);
  };

  const handleDelete = (producer) => {
    showConfirm(
      'Supprimer le producteur',
      `Êtes-vous sûr de vouloir supprimer "${producer.name}" ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.producers.delete(producer.id);
          showSuccess('Producteur supprimé', `${producer.name} a été supprimé avec succès.`);
          fetchProducers();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleModalClose = (shouldRefresh) => {
    setIsModalOpen(false);
    setSelectedProducer(null);
    if (shouldRefresh) {
      fetchProducers();
    }
  };

  const filteredProducers = producers.filter(producer =>
    producer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producer.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <p>Chargement des producteurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Producteurs</h1>
          <p className="admin-page-description">
            Gérez vos producteurs partenaires
          </p>
        </div>
        <button onClick={handleCreate} className="btn btn-primary">
          <Plus size={20} />
          Ajouter un producteur
        </button>
      </div>

      <div className="admin-page-content">
        {/* Barre de recherche */}
        <div className="admin-toolbar">
          <div className="admin-search">
            <Search size={20} />
            <input
              type="text"
              placeholder="Rechercher un producteur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-search-input"
            />
          </div>
          <div className="admin-toolbar-info">
            {filteredProducers.length} producteur(s)
          </div>
        </div>

        {/* Tableau */}
        {filteredProducers.length > 0 ? (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Spécialité</th>
                  <th>Statut</th>
                  <th>Type</th>
                  <th className="admin-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducers.map((producer) => (
                  <tr key={producer.id}>
                    <td>
                      <div className="admin-table-name">
                        {producer.name}
                        {producer.isExample && (
                          <span className="badge badge-warning badge-sm">Exemple</span>
                        )}
                      </div>
                    </td>
                    <td>{producer.email}</td>
                    <td>{producer.phone || '-'}</td>
                    <td>{producer.specialty || '-'}</td>
                    <td>
                      <span className={`admin-status-badge ${producer.isActive ? 'admin-status-active' : 'admin-status-inactive'}`}>
                        {producer.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      {producer.isExample ? (
                        <span className="badge badge-warning">Exemple</span>
                      ) : (
                        <span className="badge badge-success">Réel</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          onClick={() => handleEdit(producer)}
                          className="admin-action-btn admin-action-edit"
                          title="Modifier"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(producer)}
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
            <p>Aucun producteur trouvé</p>
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
        <ProducerModal
          producer={selectedProducer}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}