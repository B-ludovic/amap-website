'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import { plural } from '../../../lib/format';
import '../../../styles/admin/products.css';

const CATEGORIES = [
  { value: 'VEGETABLES', label: 'Légumes' },
  { value: 'FRUITS', label: 'Fruits' },
  { value: 'EGGS', label: 'Œufs' },
  { value: 'GROCERY', label: 'Épicerie' }
];

/* Saisons et formats de panier : ce sont les deux seules entrées que consulte
   le tirage hebdomadaire. La maquette ne les proposait pas au formulaire, ce
   qui aurait figé le générateur sur ce que la base contenait déjà. */
const SEASONS = [
  { value: 'SPRING', label: 'Printemps' },
  { value: 'SUMMER', label: 'Été' },
  { value: 'AUTUMN', label: 'Automne' },
  { value: 'WINTER', label: 'Hiver' }
];

const BASKET_SIZES = [
  { value: 'SMALL', label: 'Petit panier' },
  { value: 'LARGE', label: 'Grand panier' }
];

const EMPTY_FORM = {
  name: '',
  producerId: '',
  category: '',
  description: '',
  seasons: [],
  basketSizes: ['SMALL', 'LARGE'],
  isActive: true
};

function toForm(product) {
  return {
    name: product.name ?? '',
    producerId: product.producerId ?? '',
    category: product.category ?? '',
    description: product.description ?? '',
    seasons: product.seasons ?? [],
    basketSizes: product.basketSizes ?? [],
    isActive: product.isActive ?? true
  };
}

function labelsOf(list, values) {
  return values
    .map(value => list.find(item => item.value === value)?.label)
    .filter(Boolean)
    .join(', ');
}

export default function AdminProductsPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [products, setProducts] = useState([]);
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [producerFilter, setProducerFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, producersRes] = await Promise.all([
        api.admin.products.getAll(),
        api.admin.producers.getAll()
      ]);
      setProducts(productsRes.data);
      setProducers(producersRes.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter(product => {
      const matchesProducer = !producerFilter || product.producerId === producerFilter;
      const matchesSearch = !term
        || product.name.toLowerCase().includes(term)
        || (product.producer?.name ?? '').toLowerCase().includes(term);

      return matchesProducer && matchesSearch;
    });
  }, [products, search, producerFilter]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm({ ...EMPTY_FORM, producerId: producers[0]?.id ?? '' });
    setIsDirty(false);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm(toForm(product));
    setIsDirty(false);
  };

  const setField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm(current => ({ ...current, [field]: value }));
    setIsDirty(true);
  };

  const toggleInList = (field, value) => () => {
    setForm(current => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter(item => item !== value)
        : [...current[field], value]
    }));
    setIsDirty(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    /* Le schéma de validation exige au moins une saison et un format : autant
       le dire ici plutôt que de laisser le serveur renvoyer l'erreur. */
    if (form.seasons.length === 0) {
      showError('Saison manquante', 'Sélectionnez au moins une saison, sinon le produit ne sera jamais tiré.');
      return;
    }
    if (form.basketSizes.length === 0) {
      showError('Format manquant', 'Sélectionnez au moins un format de panier.');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      category: form.category || undefined,
      description: form.description || undefined
    };

    try {
      if (editing.id) {
        await api.admin.products.update(editing.id, payload);
        showSuccess('Produit modifié', `${form.name} a été mis à jour.`);
      } else {
        await api.admin.products.create(payload);
        showSuccess('Produit ajouté', `${form.name} rejoint le catalogue.`);
      }
      setEditing(null);
      fetchAll();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const product = editing;
    showConfirm(
      'Supprimer le produit',
      `Supprimer ${product.name} ? Il disparaîtra du catalogue et ne pourra plus être tiré dans les paniers.`,
      async () => {
        try {
          await api.admin.products.delete(product.id);
          showSuccess('Produit supprimé', `${product.name} a été retiré.`);
          setEditing(null);
          fetchAll();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  return (
    <div className="admin-products">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Produits</h1>
          <p className="admin-title-lead">
            {products.length} {plural(products.length, 'référence disponible', 'références disponibles')} pour composer les paniers.
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openCreate}>
          Ajouter un produit
        </button>
      </div>

      <div className="admin-toolbar-da">
        <label htmlFor="admin-products-search" className="sr-only">Rechercher un produit</label>
        <input
          id="admin-products-search"
          type="text"
          className="admin-search-field"
          placeholder="Rechercher un produit…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <label htmlFor="admin-products-producer" className="sr-only">Filtrer par producteur</label>
        <select
          id="admin-products-producer"
          className="admin-select"
          value={producerFilter}
          onChange={(event) => setProducerFilter(event.target.value)}
        >
          <option value="">Tous les producteurs</option>
          {producers.map(producer => (
            <option key={producer.id} value={producer.id}>{producer.name}</option>
          ))}
        </select>

        <span className="admin-toolbar-count">
          {filtered.length} {plural(filtered.length, 'produit', 'produits')}
        </span>
      </div>

      <div className="admin-panel admin-products-table">
        <div className="admin-table-head">
          <span>Produit</span>
          <span>Producteur</span>
          <span className="admin-products-category">Catégorie</span>
          <span>Statut</span>
          <span className="admin-cell-right">Action</span>
        </div>

        {loading ? (
          <p className="admin-empty">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="admin-empty">Aucun produit ne correspond à ces filtres.</p>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="admin-table-row">
              <span className="admin-cell-strong">{product.name}</span>
              <span className="admin-cell-muted">{product.producer?.name ?? '—'}</span>
              <span className="admin-cell-muted admin-products-category">
                {CATEGORIES.find(item => item.value === product.category)?.label ?? '—'}
              </span>
              <span>
                <span className={`admin-badge ${product.isActive ? 'admin-badge-green' : ''}`}>
                  {product.isActive ? 'Disponible' : 'Indisponible'}
                </span>
              </span>
              <span className="admin-cell-right">
                <button type="button" className="admin-btn-link" onClick={() => openEdit(product)}>
                  Modifier
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {editing && (
        <AdminModal
          title={editing.id ? 'Produit' : 'Nouveau produit'}
          width="640px"
          onClose={() => setEditing(null)}
          isDirty={isDirty}
        >
          <form onSubmit={handleSave}>
            <div className="admin-form">
              <div className="admin-form-field">
                <label htmlFor="pd-name" className="admin-field-label">Nom du produit *</label>
                <input
                  id="pd-name"
                  type="text"
                  className="admin-input"
                  placeholder="Ex : Carottes"
                  value={form.name}
                  onChange={setField('name')}
                  required
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label htmlFor="pd-prod" className="admin-field-label">Producteur *</label>
                  <select
                    id="pd-prod"
                    className="admin-select-full"
                    value={form.producerId}
                    onChange={setField('producerId')}
                    required
                  >
                    <option value="">Sélectionner un producteur</option>
                    {producers.map(producer => (
                      <option key={producer.id} value={producer.id}>{producer.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-field">
                  <label htmlFor="pd-cat" className="admin-field-label">Catégorie</label>
                  <select
                    id="pd-cat"
                    className="admin-select-full"
                    value={form.category}
                    onChange={setField('category')}
                  >
                    <option value="">Aucune catégorie</option>
                    {CATEGORIES.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form-field">
                <label htmlFor="pd-desc" className="admin-field-label">Description</label>
                <textarea
                  id="pd-desc"
                  className="admin-textarea"
                  rows={3}
                  placeholder="Décrivez le produit…"
                  value={form.description}
                  onChange={setField('description')}
                />
              </div>

              <div className="admin-form-field">
                <span className="admin-field-label">Saisons *</span>
                <div className="admin-choices">
                  {SEASONS.map(season => (
                    <label key={season.value} className="admin-choice">
                      <input
                        type="checkbox"
                        checked={form.seasons.includes(season.value)}
                        onChange={toggleInList('seasons', season.value)}
                      />
                      <span>{season.label}</span>
                    </label>
                  ))}
                </div>
                <p className="admin-product-hint">
                  Le tirage hebdomadaire ne retient que les produits de la saison en cours.
                </p>
              </div>

              <div className="admin-form-field">
                <span className="admin-field-label">Formats de panier *</span>
                <div className="admin-choices" style={{ '--admin-choices-cols': 2 }}>
                  {BASKET_SIZES.map(size => (
                    <label key={size.value} className="admin-choice">
                      <input
                        type="checkbox"
                        checked={form.basketSizes.includes(size.value)}
                        onChange={toggleInList('basketSizes', size.value)}
                      />
                      <span>{size.label}</span>
                    </label>
                  ))}
                </div>
                <p className="admin-product-hint">
                  Un produit n&apos;est tiré que pour les formules cochées ici.
                </p>
              </div>

              <label className="admin-check">
                <input type="checkbox" checked={form.isActive} onChange={setField('isActive')} />
                <span>Disponible — proposable dans les paniers</span>
              </label>
            </div>

            <div className="admin-modal-actions">
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" className="admin-btn-ghost" onClick={() => setEditing(null)}>
                Annuler
              </button>
              {editing.id && (
                <span className="admin-modal-actions-end">
                  <button type="button" className="admin-btn-danger" onClick={handleDelete}>
                    Supprimer
                  </button>
                </span>
              )}
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
