'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import AdminModal from '../../../components/admin/AdminModal';
import AdminPagination from '../../../components/admin/AdminPagination';
import { inputDate, longDate, dayMonthYear, plural } from '../../../lib/format';
import '../../../styles/admin/weekly-basket-da.css';

const FILTERS = [
  { key: 'ALL', label: 'Tous' },
  { key: 'PUBLISHED', label: 'Publiés' },
  { key: 'DRAFT', label: 'Brouillons' }
];

const SIZE_LABELS = { SMALL: 'Petit', LARGE: 'Grand' };
const ALL_SIZES = ['SMALL', 'LARGE'];

function itemName(item) {
  return item.product?.name ?? item.customProductName ?? 'Produit retiré du catalogue';
}

/* Date du prochain mercredi, proposée par défaut au tirage manuel : c'est le
   jour de distribution de l'AMAP. */
function nextWednesday() {
  const date = new Date();
  const shift = (3 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + shift);
  return inputDate(date);
}

export default function AdminWeeklyBasketPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [baskets, setBaskets] = useState([]);
  const [current, setCurrent] = useState(null);
  const [activeSubscriptions, setActiveSubscriptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const [inspected, setInspected] = useState(null);
  const [products, setProducts] = useState([]);
  const [notesTarget, setNotesTarget] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [isNotesDirty, setIsNotesDirty] = useState(false);
  const [drawDate, setDrawDate] = useState(null);
  const [isDrawDirty, setIsDrawDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);

  /* Le filtre part au serveur avec la page : trier côté client ne trierait que
     les trente paniers de la page courante, et « Brouillons » afficherait vide
     alors que la page suivante en contient. */
  const fetchAll = useCallback(async (wanted, currentFilter) => {
    setLoading(true);
    try {
      const listParams = { page: wanted, limit: 30 };
      if (currentFilter === 'PUBLISHED') listParams.published = 'true';
      if (currentFilter === 'DRAFT') listParams.published = 'false';

      const [listRes, currentRes] = await Promise.all([
        api.weeklyBaskets.getAll(listParams),
        api.weeklyBaskets.getCurrent()
      ]);
      setBaskets(listRes.data.baskets);
      setPagination(listRes.data.pagination);
      setCurrent(currentRes.data);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchAll(page, filter);
    /* Le nombre de paniers à préparer est le nombre de contrats actifs : il ne
       vit pas sur le panier, on le lit sur les statistiques. */
    api.admin.stats.get()
      .then(res => setActiveSubscriptions(res.data.stats.activeSubscriptions))
      .catch(() => {});
  }, [page, filter, fetchAll]);

  const openComposition = async (basket) => {
    try {
      const [basketRes, productsRes] = await Promise.all([
        api.weeklyBaskets.getById(basket.id),
        products.length > 0 ? Promise.resolve({ data: products }) : api.admin.products.getAll()
      ]);
      setInspected(basketRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      showError('Erreur', 'Impossible de charger la composition.');
    }
  };

  const reloadInspected = async (basketId) => {
    const response = await api.weeklyBaskets.getById(basketId);
    setInspected(response.data);
    fetchAll(page, filter);
  };

  const handlePublish = (basket) => {
    showConfirm(
      'Publier le panier',
      `Publier la semaine ${basket.weekNumber} ? Les adhérents actifs en seront informés par email.`,
      async () => {
        try {
          await api.weeklyBaskets.publish(basket.id);
          showSuccess('Panier publié', 'Les adhérents ont été prévenus.');
          fetchAll(page, filter);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleDelete = (basket) => {
    showConfirm(
      'Supprimer le panier',
      `Supprimer la semaine ${basket.weekNumber} ? Le tirage automatique le recréera lors de son prochain passage.`,
      async () => {
        try {
          await api.weeklyBaskets.delete(basket.id);
          showSuccess('Panier supprimé', 'Le panier a été retiré.');
          setInspected(null);
          fetchAll(page, filter);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleSaveNotes = async () => {
    setBusy(true);
    try {
      await api.weeklyBaskets.update(notesTarget.id, { notes: notesDraft });
      showSuccess('Message enregistré', 'Le message de la semaine a été mis à jour.');
      setNotesTarget(null);
      fetchAll(page, filter);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  /* Le tirage manuel passe par la même fonction que le job : si un panier
     existe déjà pour cette semaine, elle le renvoie au lieu d'en créer un
     second. Il n'y a donc aucun risque de doublon. */
  const handleDraw = async () => {
    setBusy(true);
    try {
      await api.weeklyBaskets.create({ distributionDate: new Date(drawDate).toISOString() });
      showSuccess('Tirage effectué', 'Le panier de cette semaine est prêt.');
      setDrawDate(null);
      fetchAll(page, filter);
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveItem = (itemId) => {
    showConfirm(
      'Retirer du panier',
      'Retirer cette entrée de la composition tirée ?',
      async () => {
        try {
          await api.weeklyBaskets.removeProduct(inspected.id, itemId);
          await reloadInspected(inspected.id);
        } catch (error) {
          showError('Erreur', error.message);
        }
      }
    );
  };

  const handleAddItem = async (productId) => {
    if (!productId) return;
    try {
      await api.weeklyBaskets.addProduct(inspected.id, { productId, basketSizes: ALL_SIZES });
      await reloadInspected(inspected.id);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const handleToggleSize = async (item, size) => {
    const next = item.basketSizes.includes(size)
      ? item.basketSizes.filter(value => value !== size)
      : [...item.basketSizes, size];

    if (next.length === 0) {
      showError('Format requis', 'Une entrée doit appartenir à au moins une formule.');
      return;
    }

    try {
      await api.weeklyBaskets.updateProduct(inspected.id, item.id, {
        productId: item.productId ?? undefined,
        customProductName: item.customProductName ?? undefined,
        basketSizes: next
      });
      await reloadInspected(inspected.id);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const countFor = (basket, size) =>
    basket.items?.filter(item => item.basketSizes.includes(size)).length ?? 0;

  return (
    <div className="admin-baskets">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Panier hebdomadaire</h1>
          <p className="admin-title-lead">
            Le panier est tiré automatiquement chaque jeudi parmi les produits actifs de la
            saison, puis figé en base. Cet écran rend compte du tirage et permet de le corriger.
          </p>
        </div>
        <button type="button" className="admin-btn-ghost" onClick={() => {
          setDrawDate(nextWednesday());
          setIsDrawDirty(false);
        }}>
          Tirer un panier
        </button>
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : (
        <>
          {current && (
            <div className="admin-basket-current">
              <div>
                <div className="admin-basket-current-head">
                  <span className="admin-mono-label">Panier en cours</span>
                  <span className="admin-badge admin-badge-green">Publié</span>
                </div>
                <h2 className="admin-basket-current-title">
                  Semaine {current.weekNumber} — {current.year}
                </h2>
                <p className="admin-basket-current-facts">
                  {longDate(current.distributionDate)} · {current.items.length}{' '}
                  {plural(current.items.length, 'produit', 'produits')}
                  {activeSubscriptions !== null && ` · ${activeSubscriptions} ${plural(activeSubscriptions, 'panier à préparer', 'paniers à préparer')}`}
                </p>
                {current.notes && (
                  <p className="admin-basket-current-notes">{current.notes}</p>
                )}
              </div>
              <div className="admin-basket-current-actions">
                <button type="button" className="admin-btn-ghost" onClick={() => openComposition(current)}>
                  Voir la composition
                </button>
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={() => {
                    setNotesTarget(current);
                    setNotesDraft(current.notes ?? '');
                    setIsNotesDirty(false);
                  }}
                >
                  Le mot de la semaine
                </button>
              </div>
            </div>
          )}

          <div className="admin-pills">
            {FILTERS.map(item => (
              <button
                key={item.key}
                type="button"
                className={`admin-pill ${filter === item.key ? 'admin-pill-active' : ''}`}
                onClick={() => { setFilter(item.key); setPage(1); }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {baskets.length === 0 ? (
            <div className="admin-empty-card">
              <p className="admin-empty-card-title">Aucun panier</p>
              <p className="admin-empty-card-note">Rien à afficher avec ce filtre.</p>
            </div>
          ) : (
            <div className="admin-grid-3">
              {baskets.map((basket) => (
                <article key={basket.id} className="admin-panel">
                  <div className="admin-item-head">
                    <div>
                      <h2 className="admin-item-title">Semaine {basket.weekNumber} — {basket.year}</h2>
                      <p className="admin-item-meta">{dayMonthYear(basket.distributionDate)}</p>
                    </div>
                    <span className={`admin-badge ${basket.isPublished ? 'admin-badge-green' : 'admin-badge-amber'}`}>
                      {basket.isPublished ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>

                  <div className="admin-item-body">
                    <span className="admin-mono-label">
                      {basket.items.length} {plural(basket.items.length, 'produit tiré', 'produits tirés')}
                      {' · '}
                      {countFor(basket, 'SMALL')} petit / {countFor(basket, 'LARGE')} grand
                    </span>
                    <div className="admin-basket-preview">
                      {basket.items.slice(0, 4).map(item => (
                        <span key={item.id} className="admin-basket-preview-item">· {itemName(item)}</span>
                      ))}
                      {basket.items.length > 4 && (
                        <span className="admin-basket-preview-item">
                          · et {basket.items.length - 4} {plural(basket.items.length - 4, 'autre', 'autres')}
                        </span>
                      )}
                    </div>
                    {/* Publier envoie un email à tous les abonnés actifs : sans
                        cette ligne, rien à l'écran ne distingue une annonce
                        partie de bout en bout d'une annonce interrompue. */}
                    {basket.isPublished && (
                      <span className="admin-mono-label">
                        {basket.notifiedCount} {plural(basket.notifiedCount, 'abonné prévenu', 'abonnés prévenus')}
                        {basket.notifyingSince && ' pour l\'instant'}
                        {basket.notifyFailedCount > 0 && (
                          <span className="admin-basket-notify-failed">
                            {' · '}{basket.notifyFailedCount} non {plural(basket.notifyFailedCount, 'joint', 'joints')}
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="admin-basket-card-footer">
                    <button type="button" className="admin-btn-link" onClick={() => openComposition(basket)}>
                      Composition
                    </button>
                    {!basket.isPublished && (
                      <>
                        <span className="admin-basket-card-sep">·</span>
                        <button
                          type="button"
                          className="admin-btn-link admin-btn-link-publish"
                          onClick={() => handlePublish(basket)}
                        >
                          Publier
                        </button>
                      </>
                    )}
                    <span className="admin-basket-card-end">
                      <button
                        type="button"
                        className="admin-btn-link admin-btn-link-delete"
                        onClick={() => handleDelete(basket)}
                      >
                        Supprimer
                      </button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          <AdminPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {inspected && (
        <AdminModal
          title={`Semaine ${inspected.weekNumber} — ${inspected.year}`}
          width="820px"
          onClose={() => setInspected(null)}
        >
          <div className="admin-basket-split">
            <span className="admin-basket-split-item">
              Distribution : {longDate(inspected.distributionDate)}
            </span>
            <span className="admin-basket-split-item">
              Petit panier : {countFor(inspected, 'SMALL')} produits
            </span>
            <span className="admin-basket-split-item">
              Grand panier : {countFor(inspected, 'LARGE')} produits
            </span>
          </div>

          <div className="admin-basket-items">
            <div className="admin-basket-items-head">
              <span>Produit tiré</span>
              <span>Formules</span>
              <span className="admin-cell-right">Retirer</span>
            </div>

            {inspected.items.map(item => (
              <div key={item.id} className="admin-basket-item">
                <span>
                  {itemName(item)}
                  {item.product?.producer?.name && (
                    <span className="admin-basket-item-producer">{item.product.producer.name}</span>
                  )}
                </span>
                <span className="admin-basket-item-sizes">
                  {ALL_SIZES.map(size => (
                    <label key={size} className="admin-choice">
                      <input
                        type="checkbox"
                        checked={item.basketSizes.includes(size)}
                        onChange={() => handleToggleSize(item, size)}
                      />
                      <span>{SIZE_LABELS[size]}</span>
                    </label>
                  ))}
                </span>
                <span className="admin-cell-right">
                  <button
                    type="button"
                    className="admin-btn-link admin-btn-link-delete"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    Retirer
                  </button>
                </span>
              </div>
            ))}

            <div className="admin-basket-items-add">
              <label htmlFor="admin-basket-add" className="admin-field-label" style={{ marginBottom: 0 }}>
                Ajouter un produit
              </label>
              <select
                id="admin-basket-add"
                className="admin-select"
                value=""
                onChange={(event) => handleAddItem(event.target.value)}
              >
                <option value="">Choisir dans le catalogue…</option>
                {products
                  .filter(product => product.isActive)
                  .map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="admin-modal-actions">
            {!inspected.isPublished && (
              <button type="button" className="admin-btn-forest" onClick={() => handlePublish(inspected)}>
                Publier le panier
              </button>
            )}
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => {
                setNotesTarget(inspected);
                setNotesDraft(inspected.notes ?? '');
                setIsNotesDirty(false);
              }}
            >
              Le mot de la semaine
            </button>
            <span className="admin-modal-actions-end">
              <button type="button" className="admin-btn-danger" onClick={() => handleDelete(inspected)}>
                Supprimer
              </button>
            </span>
          </div>
        </AdminModal>
      )}

      {notesTarget && (
        <AdminModal
          title="Le mot de la semaine"
          width="560px"
          onClose={() => setNotesTarget(null)}
          isDirty={isNotesDirty}
        >
          <div className="admin-form">
            <div className="admin-form-field">
              <label htmlFor="admin-basket-notes" className="admin-field-label">
                Semaine {notesTarget.weekNumber} — {notesTarget.year}
              </label>
              <textarea
                id="admin-basket-notes"
                className="admin-textarea"
                rows={4}
                placeholder="Le mot de la semaine, pour les adhérents…"
                value={notesDraft}
                onChange={(event) => {
                  setNotesDraft(event.target.value);
                  setIsNotesDirty(true);
                }}
              />
            </div>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-primary" onClick={handleSaveNotes} disabled={busy}>
              Enregistrer
            </button>
            <button type="button" className="admin-btn-ghost" onClick={() => setNotesTarget(null)}>
              Annuler
            </button>
          </div>
        </AdminModal>
      )}

      {drawDate && (
        <AdminModal title="Tirer un panier" width="560px" onClose={() => setDrawDate(null)} isDirty={isDrawDirty}>
          <div className="admin-form">
            <div className="admin-form-field">
              <label htmlFor="admin-basket-draw" className="admin-field-label">Date de distribution</label>
              <input
                id="admin-basket-draw"
                type="date"
                className="admin-input admin-input-mono"
                value={drawDate}
                onChange={(event) => {
                  setDrawDate(event.target.value);
                  setIsDrawDirty(true);
                }}
              />
            </div>
            <p className="admin-product-hint">
              Le tirage pioche parmi les produits actifs de la saison correspondante. Si un panier
              existe déjà pour cette semaine, il est renvoyé tel quel — aucun doublon n&apos;est créé.
            </p>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn-primary" onClick={handleDraw} disabled={busy}>
              {busy ? 'Tirage…' : 'Lancer le tirage'}
            </button>
            <button type="button" className="admin-btn-ghost" onClick={() => setDrawDate(null)}>
              Annuler
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
