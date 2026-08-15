'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import { phone, plural } from '../../../lib/format';
import '../../../styles/admin/producers.css';

/* La maquette n'offrait qu'une case « Certifiée Agriculture Biologique », or
   ProducerCertification compte trois états et la page publique affiche « En
   conversion ». Une case à cocher ne sait pas dire ce troisième état. */
const CERTIFICATIONS = [
  { value: 'NONE', label: 'Aucune mention' },
  { value: 'ORGANIC', label: 'Certifiée Agriculture Biologique' },
  { value: 'CONVERSION', label: 'En conversion bio' }
];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  specialty: '',
  description: '',
  image: '',
  city: '',
  postalCode: '',
  distanceKm: '',
  certification: 'NONE',
  farmDetailLabel: '',
  farmDetail: '',
  partnerSince: '',
  isActive: true
};

function toForm(producer) {
  return {
    name: producer.name ?? '',
    email: producer.email ?? '',
    phone: producer.phone ?? '',
    specialty: producer.specialty ?? '',
    description: producer.description ?? '',
    image: producer.image ?? '',
    city: producer.city ?? '',
    postalCode: producer.postalCode ?? '',
    distanceKm: producer.distanceKm ?? '',
    certification: producer.certification ?? 'NONE',
    farmDetailLabel: producer.farmDetailLabel ?? '',
    farmDetail: producer.farmDetail ?? '',
    partnerSince: producer.partnerSince ?? '',
    isActive: producer.isActive ?? true
  };
}

export default function AdminProducersPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fetchProducers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.admin.producers.getAll();
      setProducers(response.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les producteurs.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchProducers();
  }, [fetchProducers]);

  /* La liste des producteurs tient en une page : le filtre reste local, sans
     aller-retour serveur. */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return producers;

    return producers.filter(producer =>
      [producer.name, producer.email, producer.specialty, producer.city]
        .filter(Boolean)
        .some(field => field.toLowerCase().includes(term))
    );
  }, [producers, search]);

  /* « toutes à moins de N km » n'est affirmé que si chaque ferme porte
     effectivement une distance : sinon la phrase parlerait pour des fermes
     dont on ne sait rien. Le seuil est arrondi aux cinq kilomètres supérieurs,
     pour annoncer un ordre de grandeur plutôt qu'un « moins de 29 km » qui
     sonne comme une mesure. */
  const distanceCap = useMemo(() => {
    const active = producers.filter(producer => producer.isActive);
    if (active.length === 0 || active.some(producer => producer.distanceKm == null)) return null;
    const furthest = Math.max(...active.map(producer => producer.distanceKm));
    return Math.ceil((furthest + 1) / 5) * 5;
  }, [producers]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(EMPTY_FORM);
    setIsDirty(false);
  };

  const openEdit = (producer) => {
    setEditing(producer);
    setForm(toForm(producer));
    setIsDirty(false);
  };

  const setField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm(current => ({ ...current, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      if (editing.id) {
        await api.admin.producers.update(editing.id, form);
        showSuccess('Producteur modifié', `${form.name} a été mis à jour.`);
      } else {
        await api.admin.producers.create(form);
        showSuccess('Producteur ajouté', `${form.name} rejoint les fermes partenaires.`);
      }
      setEditing(null);
      fetchProducers();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const producer = editing;
    showConfirm(
      'Supprimer le producteur',
      producer._count?.products > 0
        ? `${producer.name} porte ${producer._count.products} ${plural(producer._count.products, 'produit', 'produits')}. La suppression échouera tant qu'ils existent — désactivez plutôt la ferme.`
        : `Supprimer ${producer.name} ? Cette action est irréversible.`,
      async () => {
        try {
          await api.admin.producers.delete(producer.id);
          showSuccess('Producteur supprimé', `${producer.name} a été retiré.`);
          setEditing(null);
          fetchProducers();
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  return (
    <div className="admin-producers">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Producteurs</h1>
          <p className="admin-title-lead">
            {producers.length} {plural(producers.length, 'ferme partenaire', 'fermes partenaires')}
            {distanceCap !== null && `, toutes à moins de ${distanceCap} km`}.
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openCreate}>
          Ajouter un producteur
        </button>
      </div>

      <div className="admin-toolbar-da">
        <label htmlFor="admin-producers-search" className="sr-only">Rechercher un producteur</label>
        <input
          id="admin-producers-search"
          type="text"
          className="admin-search-field"
          placeholder="Rechercher un producteur…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="admin-panel admin-producers-table">
        <div className="admin-table-head">
          <span>Ferme</span>
          <span>Email</span>
          <span className="admin-producers-phone">Téléphone</span>
          <span>Spécialité</span>
          <span>Statut</span>
          <span className="admin-cell-right">Action</span>
        </div>

        {loading ? (
          <p className="admin-empty">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="admin-empty">Aucun producteur ne correspond à cette recherche.</p>
        ) : (
          filtered.map((producer) => (
            <div key={producer.id} className="admin-table-row">
              <span className="admin-cell-strong">{producer.name}</span>
              <span className="admin-cell-mono admin-producers-email">{producer.email}</span>
              <span className="admin-cell-mono admin-producers-phone">{phone(producer.phone)}</span>
              <span className="admin-cell-muted">{producer.specialty || '—'}</span>
              <span>
                <span className={`admin-badge ${producer.isActive ? 'admin-badge-green' : ''}`}>
                  {producer.isActive ? 'Actif' : 'Inactif'}
                </span>
              </span>
              <span className="admin-cell-right">
                <button type="button" className="admin-btn-link" onClick={() => openEdit(producer)}>
                  Modifier
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {editing && (
        <AdminModal
          title={editing.id ? 'Producteur' : 'Nouveau producteur'}
          width="640px"
          onClose={() => setEditing(null)}
          isDirty={isDirty}
        >
          <form onSubmit={handleSave}>
            <div className="admin-form">
              <div className="admin-form-field">
                <label htmlFor="pr-name" className="admin-field-label">Nom de l&apos;exploitation *</label>
                <input
                  id="pr-name"
                  type="text"
                  className="admin-input"
                  placeholder="Ex : Ferme des Lilas"
                  value={form.name}
                  onChange={setField('name')}
                  required
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label htmlFor="pr-email" className="admin-field-label">Email *</label>
                  <input
                    id="pr-email"
                    type="email"
                    className="admin-input"
                    placeholder="contact@ferme.fr"
                    value={form.email}
                    onChange={setField('email')}
                    required
                  />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="pr-phone" className="admin-field-label">Téléphone</label>
                  <input
                    id="pr-phone"
                    type="text"
                    className="admin-input"
                    placeholder="06 12 34 56 78"
                    value={form.phone}
                    onChange={setField('phone')}
                  />
                </div>
              </div>

              <div className="admin-form-field">
                <label htmlFor="pr-spe" className="admin-field-label">Spécialité</label>
                <input
                  id="pr-spe"
                  type="text"
                  className="admin-input"
                  placeholder="Ex : Légumes de saison"
                  value={form.specialty}
                  onChange={setField('specialty')}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="pr-desc" className="admin-field-label">Description *</label>
                <textarea
                  id="pr-desc"
                  className="admin-textarea"
                  rows={4}
                  placeholder="Présentez le producteur…"
                  value={form.description}
                  onChange={setField('description')}
                  required
                />
              </div>

              <label className="admin-check">
                <input type="checkbox" checked={form.isActive} onChange={setField('isActive')} />
                <span>Producteur actif — visible sur le site public</span>
              </label>
            </div>

            <div className="admin-farm-section">
              <span className="admin-mono-label admin-farm-section-label">
                Fiche de la ferme — page publique
              </span>

              <div className="admin-form">
                <div className="admin-form-field">
                  <label htmlFor="pr-cert" className="admin-field-label">Certification</label>
                  <select
                    id="pr-cert"
                    className="admin-select-full"
                    value={form.certification}
                    onChange={setField('certification')}
                  >
                    {CERTIFICATIONS.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-row" style={{ '--admin-form-cols': 3 }}>
                  <div className="admin-form-field">
                    <label htmlFor="pr-city" className="admin-field-label">Commune</label>
                    <input
                      id="pr-city"
                      type="text"
                      className="admin-input"
                      placeholder="Ex : Sèvres"
                      value={form.city}
                      onChange={setField('city')}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label htmlFor="pr-postal" className="admin-field-label">Code postal</label>
                    <input
                      id="pr-postal"
                      type="text"
                      inputMode="numeric"
                      className="admin-input admin-input-mono"
                      placeholder="92310"
                      value={form.postalCode}
                      onChange={setField('postalCode')}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label htmlFor="pr-distance" className="admin-field-label">Distance (km)</label>
                    <input
                      id="pr-distance"
                      type="text"
                      inputMode="numeric"
                      className="admin-input admin-input-mono"
                      placeholder="9"
                      value={form.distanceKm}
                      onChange={setField('distanceKm')}
                    />
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <label htmlFor="pr-detail-label" className="admin-field-label">Libellé de détail</label>
                    <input
                      id="pr-detail-label"
                      type="text"
                      className="admin-input"
                      placeholder="Ex : Surface, Cheptel"
                      value={form.farmDetailLabel}
                      onChange={setField('farmDetailLabel')}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label htmlFor="pr-detail" className="admin-field-label">Détail</label>
                    <input
                      id="pr-detail"
                      type="text"
                      className="admin-input"
                      placeholder="Ex : 4 hectares · 2 serres froides"
                      value={form.farmDetail}
                      onChange={setField('farmDetail')}
                    />
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <label htmlFor="pr-since" className="admin-field-label">Partenaire depuis</label>
                    <input
                      id="pr-since"
                      type="text"
                      inputMode="numeric"
                      className="admin-input admin-input-mono"
                      placeholder="2019"
                      value={form.partnerSince}
                      onChange={setField('partnerSince')}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label htmlFor="pr-image" className="admin-field-label">Image</label>
                    <input
                      id="pr-image"
                      type="text"
                      className="admin-input"
                      placeholder="/placeholder/ferme.webp"
                      value={form.image}
                      onChange={setField('image')}
                    />
                  </div>
                </div>
              </div>
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
