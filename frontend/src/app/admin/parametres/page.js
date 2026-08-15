'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import logger from '../../../lib/logger';
import { plural } from '../../../lib/format';
import { useModal } from '../../../contexts/ModalContext';
import '../../../styles/admin/parametres-da.css';

export default function AdminParametresPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [examples, setExamples] = useState(null);
  const [totals, setTotals] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.admin.examples.getStats();
      setExamples(response.data.examples);
      setTotals(response.data.totals);
    } catch (error) {
      logger.error('Erreur lors du chargement des paramètres:', error);
      /* Distinguer l'échec du vide : sans cet état, une API injoignable
         afficherait « aucun réglage » et laisserait croire que tout va bien. */
      setLoadError(error.message || 'Impossible de charger les paramètres.');
      setExamples(null);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasExamples = (examples?.total ?? 0) > 0;

  const handleDeleteExamples = () => {
    /* Le récapitulatif énumère les trois familles que l'API supprime réellement.
       Il annonçait auparavant un nombre de paniers que la réponse ne contient
       pas, et affichait donc « undefined panier(s) » juste avant une action
       irréversible. */
    showConfirm(
      'Supprimer les données d’exemple',
      `Cette action supprimera définitivement ${examples.producers} ${plural(examples.producers, 'producteur', 'producteurs')}, ` +
      `${examples.products} ${plural(examples.products, 'produit', 'produits')} et ` +
      `${examples.pickupLocations} ${plural(examples.pickupLocations, 'point de retrait', 'points de retrait')} ` +
      `marqués comme exemples. Elle est irréversible. Continuer ?`,
      async () => {
        setDeleting(true);
        try {
          await api.admin.examples.deleteAll();
          showSuccess('Exemples supprimés', 'Les jeux d’essai ont été retirés de la base.');
          await fetchData();
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setDeleting(false);
        }
      }
    );
  };

  return (
    <div className="admin-parametres">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Paramètres</h1>
          <p className="admin-title-lead">
            Les réglages apparaissent ici au fil des besoins de l’équipe. Rien qui
            engage les données des adhérents, les tarifs ou la facturation n’y est
            exposé sans demande explicite.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : loadError ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Paramètres indisponibles</p>
          <p className="admin-empty-card-note">{loadError}</p>
          <button type="button" className="admin-btn-ghost" onClick={fetchData}>
            Réessayer
          </button>
        </div>
      ) : hasExamples ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Données d’exemple</h2>
            <button
              type="button"
              className="admin-btn-danger"
              onClick={handleDeleteExamples}
              disabled={deleting}
            >
              {deleting ? 'Suppression…' : `Supprimer les ${examples.total} exemples`}
            </button>
          </div>

          <div className="admin-panel-body">
            <p className="admin-parametres-note">
              Ces enregistrements portent le marqueur <code>isExample</code>, posé par{' '}
              <code>prisma/seed.js</code> pour éprouver la plateforme avant sa mise en
              service. Les supprimer ne touche à rien d’autre : seuls les
              enregistrements marqués partent, vos propres données restent en place.
            </p>

            <div className="admin-parametres-facts">
              <div>
                <p className="admin-parametres-count">
                  {examples.producers} <span>sur {totals.producers}</span>
                </p>
                <p className="admin-mono-label">Producteurs</p>
              </div>
              <div>
                <p className="admin-parametres-count">
                  {examples.products} <span>sur {totals.products}</span>
                </p>
                <p className="admin-mono-label">Produits</p>
              </div>
              <div>
                <p className="admin-parametres-count">
                  {examples.pickupLocations} <span>sur {totals.pickupLocations}</span>
                </p>
                <p className="admin-mono-label">Points de retrait</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucun réglage pour l’instant</p>
          <p className="admin-empty-card-note">
            Les jeux d’essai ont déjà été retirés de la base. Cet écran se remplira
            au fil des demandes de l’équipe.
          </p>
        </div>
      )}
    </div>
  );
}
