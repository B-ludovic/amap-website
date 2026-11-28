'use client';

import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import { dayMonthYearLong } from '../../../lib/format';
import { CATEGORIES, SEASONS, BASKET_SIZES, labelOf } from '../../../lib/productLabels';
import ProductForm, { nounOf } from '../../../components/producer/ProductForm';

const listOf = (list, values) => values.map((value) => labelOf(list, value)).join(', ');

function ProductCard({ product, onEdit, onRequestDeletion, onCancelDeletion, busy }) {
  const pending = Boolean(product.deletionRequestedAt);

  return (
    <article className="pspace-product">
      <div className="pspace-product-head">
        <h2 className="pspace-product-name">{product.name}</h2>
        {product.category && <span className="pspace-product-category">{labelOf(CATEGORIES, product.category)}</span>}
      </div>

      <dl className="pspace-product-facts">
        <div><dt>Saisons</dt><dd>{listOf(SEASONS, product.seasons)}</dd></div>
        <div><dt>Paniers</dt><dd>{listOf(BASKET_SIZES, product.basketSizes)}</dd></div>
      </dl>

      {pending ? (
        <p className="pspace-product-status is-pending">
          Suppression demandée le {dayMonthYearLong(product.deletionRequestedAt)}. En attendant l&apos;AMAP,
          ce produit n&apos;entre plus dans les paniers.
        </p>
      ) : !product.isActive && (
        <p className="pspace-product-status">
          Vous ne produisez plus {nounOf(product.category)}. Le produit n&apos;entre plus dans les paniers.
        </p>
      )}

      <div className="pspace-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit} disabled={busy}>
          Modifier
        </button>
        {pending ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancelDeletion} disabled={busy}>
            Annuler la demande
          </button>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRequestDeletion} disabled={busy}>
            Demander la suppression
          </button>
        )}
      </div>
    </article>
  );
}

export default function ProducerProductsPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.producerSpace.getProducts()
    .then((response) => {
      setProducts(response.data.products);
      setLoadError('');
    })
    .catch((error) => setLoadError(error.message)), []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (action) => {
    try {
      const response = await action();
      showSuccess('Produit', response.message);
      setEditing(null);
      await load();
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const run = async (action) => {
    setBusy(true);
    try {
      const response = await action();
      showSuccess('Produit', response.message);
      await load();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = (product) => {
    showConfirm(
      'Demander la suppression',
      `La suppression de « ${product.name} » est faite par l'AMAP. En attendant, ce produit n'entre plus dans les paniers.`,
      () => run(() => api.producerSpace.requestProductDeletion(product.id))
    );
  };

  if (loadError) {
    return (
      <div className="notice-band">
        <span className="notice-band-dot" aria-hidden="true" />
        <p className="notice-band-text">{loadError}</p>
      </div>
    );
  }

  return (
    <>
      <header className="pspace-head">
        <div className="eyebrow">Espace producteur</div>
        <h1 className="pspace-title">Mes produits</h1>
        <p className="pspace-lede">
          Le panier de la semaine est tiré au hasard parmi vos produits actifs de la saison.
        </p>
      </header>

      {editing === 'new' ? (
        <section className="pspace-product is-editing" aria-label="Nouveau produit">
          <ProductForm
            submitLabel="Ajouter le produit"
            onCancel={() => setEditing(null)}
            onSubmit={(data) => save(() => api.producerSpace.createProduct(data))}
          />
        </section>
      ) : (
        <button type="button" className="btn btn-primary btn-lg pspace-submit pspace-add" onClick={() => setEditing('new')}>
          Ajouter un produit
        </button>
      )}

      {products === null ? (
        <p className="pspace-loading">Chargement…</p>
      ) : products.length === 0 ? (
        <p className="pspace-lede">Aucun produit pour l&apos;instant.</p>
      ) : (
        <div className="pspace-product-list">
          {products.map((product) => (
            editing === product.id ? (
              <section key={product.id} className="pspace-product is-editing" aria-label={`Modifier ${product.name}`}>
                <ProductForm
                  product={product}
                  submitLabel="Enregistrer"
                  onCancel={() => setEditing(null)}
                  onSubmit={(data) => save(() => api.producerSpace.updateProduct(product.id, data))}
                />
              </section>
            ) : (
              <ProductCard
                key={product.id}
                product={product}
                busy={busy}
                onEdit={() => setEditing(product.id)}
                onRequestDeletion={() => requestDeletion(product)}
                onCancelDeletion={() => run(() => api.producerSpace.cancelProductDeletion(product.id))}
              />
            )
          ))}
        </div>
      )}
    </>
  );
}
