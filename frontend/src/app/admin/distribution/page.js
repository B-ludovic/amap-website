'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import logger from '../../../lib/logger';
import { longDate, phone, plural, time } from '../../../lib/format';
import { filterMembers } from '../../../lib/memberSearch';
import { useModal } from '../../../contexts/ModalContext';
import PickupNoteModal from '../../../components/admin/PickupNoteModal';
import '../../../styles/admin/distribution-da.css';

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export default function AdminDistributionPage() {
  const [currentBasket, setCurrentBasket] = useState(null);
  const [distributionList, setDistributionList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [basketError, setBasketError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteTarget, setNoteTarget] = useState(null);

  const { showError } = useModal();

  const fetchCurrentBasket = useCallback(async () => {
    setLoading(true);
    setBasketError(null);
    try {
      const response = await api.weeklyBaskets.getCurrent();
      setCurrentBasket(response.data ?? null);
    } catch (error) {
      logger.error('Erreur:', error);
      setCurrentBasket(null);
      setBasketError(error.message || 'Impossible de charger la distribution.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentBasket();
  }, [fetchCurrentBasket]);

  /* Un seul chargement, au montage puis à chaque changement de panier : la
     liste complète des abonnés actifs de la semaine. Le serveur ne filtre plus
     rien, il n'y a donc qu'une seule vérité — et les compteurs qu'il renvoie
     portent toujours sur l'ensemble, quoi qu'affiche la recherche. */
  const fetchDistributionList = useCallback(async () => {
    if (!currentBasket) return;

    setListLoading(true);
    try {
      const response = await api.distribution.getList(currentBasket.id);

      setDistributionList(response.data.list);
      setStats({
        totalSubscribers: response.data.totalSubscribers,
        pickedUp: response.data.pickedUp,
        pending: response.data.pending,
      });
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setListLoading(false);
    }
  }, [currentBasket, showError]);

  useEffect(() => {
    fetchDistributionList();
  }, [fetchDistributionList]);

  /* Filtrage dans le navigateur : la liste entière y est déjà, la réponse est
     donc immédiate à chaque touche, sans aller-retour réseau ni pause de
     frappe. C'est ce qui compte le mercredi soir, quand la file avance et que
     le wifi de la salle est ce qu'il est. La règle de comparaison elle-même vit
     dans lib/memberSearch.js : c'est du métier, pas de la présentation. */
  const visibleList = useMemo(
    () => filterMembers(distributionList, searchTerm),
    [distributionList, searchTerm]
  );

  // Remplace le retrait d'une seule ligne, sans toucher au reste de la liste.
  const patchRow = (subscriptionId, pickup) => {
    setDistributionList(list =>
      list.map(row => (row.subscriptionId === subscriptionId ? { ...row, pickup } : row))
    );
  };

  const shiftCounters = (delta) => {
    setStats(current => current && {
      ...current,
      pickedUp: current.pickedUp + delta,
      pending: current.pending - delta,
    });
  };

  /* Pointage optimiste : à la table, la ligne doit réagir au doigt et non au
     réseau. On ne recharge pas la liste — le serveur renvoie le retrait
     enregistré, qu'on fond dans la ligne pour récupérer son identifiant (cas
     d'une première coche) et l'heure de retrait dont l'export a besoin.
     Pas de modale de succès : la bande qui verdit et le compteur qui avance
     sont déjà l'accusé de réception. */
  const handleTogglePickup = async (item) => {
    const newStatus = !item.pickup?.wasPickedUp;

    patchRow(item.subscriptionId, { ...item.pickup, wasPickedUp: newStatus });
    shiftCounters(newStatus ? 1 : -1);

    try {
      const response = item.pickup
        ? await api.distribution.markAsPickedUp(item.pickup.id, {
            wasPickedUp: newStatus,
            weeklyBasketId: currentBasket.id,
          })
        : await api.distribution.markAsPickedUp('new', {
            subscriptionId: item.subscriptionId,
            weeklyBasketId: currentBasket.id,
            wasPickedUp: newStatus,
          });

      if (response.data) patchRow(item.subscriptionId, response.data);
    } catch (error) {
      // Retour en arrière ciblé : un pointage voisin en cours n'est pas écrasé.
      patchRow(item.subscriptionId, item.pickup);
      shiftCounters(newStatus ? -1 : 1);
      showError('Erreur', error.message);
    }
  };

  const handleNoteClosed = (pickup) => {
    if (pickup) patchRow(noteTarget.subscriptionId, pickup);
    setNoteTarget(null);
  };

  /* L'export est fabriqué par le serveur, pas ici. Trois raisons, dans l'ordre
     d'importance : c'est la seule voie journalisée, et un export emporte les
     noms, emails et téléphones des adhérents ; le serveur relit tous les
     abonnements actifs, là où cette page ne détient que la liste filtrée par la
     recherche en cours ; et la taille du panier y est lue au bon endroit. */
  const handleExport = async () => {
    try {
      await api.distribution.export(currentBasket.id);
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const basketLabel = (size) => (size === 'SMALL' ? 'Petit panier' : 'Grand panier');

  if (loading) {
    return <p className="admin-empty">Chargement…</p>;
  }

  if (basketError) {
    return (
      <div className="admin-empty-card">
        <p className="admin-empty-card-title">Distribution indisponible</p>
        <p className="admin-empty-card-note">{basketError}</p>
        <button type="button" className="admin-btn-ghost" onClick={fetchCurrentBasket}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!currentBasket) {
    return (
      <div className="admin-empty-card">
        <p className="admin-empty-card-title">Aucune distribution en cours</p>
        <p className="admin-empty-card-note">Publiez un panier hebdomadaire pour ouvrir l’émargement.</p>
      </div>
    );
  }

  const rate = stats && stats.totalSubscribers > 0
    ? Math.round((stats.pickedUp / stats.totalSubscribers) * 100)
    : 0;

  return (
    <div className="admin-distribution">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Distribution</h1>
          <p className="admin-title-lead">
            Émargement du {capitalize(longDate(currentBasket.distributionDate))} — semaine {currentBasket.weekNumber}.
            Chaque panier remis est enregistré aussitôt coché.
          </p>
        </div>
        <button type="button" className="admin-btn-ghost" onClick={handleExport}>
          Exporter la liste
        </button>
      </div>

      {stats && (
        <div className="admin-distribution-progress">
          <div className="admin-distribution-track">
            <div className="admin-distribution-fill" style={{ width: `${rate}%` }} />
          </div>
          <p className="admin-distribution-rate">{rate}&nbsp;%</p>
          <p className="admin-distribution-legend">
            <strong>{stats.pickedUp}</strong> {plural(stats.pickedUp, 'panier remis', 'paniers remis')}
            {' · '}
            <strong>{stats.pending}</strong> en attente
            {' · '}
            <strong>{stats.totalSubscribers}</strong> {plural(stats.totalSubscribers, 'adhérent attendu', 'adhérents attendus')}
          </p>
        </div>
      )}

      <div className="admin-toolbar-da">
        <label htmlFor="search-distribution" className="sr-only">Rechercher un adhérent</label>
        <input
          id="search-distribution"
          type="search"
          className="admin-search-field"
          placeholder="Nom, n° d’abonnement, email, téléphone…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoComplete="off"
        />
        {/* Le décompte change sans que le focus quitte le champ : sans role
            status, un lecteur d’écran ne l’annoncerait jamais. */}
        <span className="admin-toolbar-count" role="status" aria-live="polite">
          {searchTerm
            ? `${visibleList.length} sur ${distributionList.length}`
            : `${distributionList.length} ${plural(distributionList.length, 'adhérent', 'adhérents')}`}
        </span>
      </div>

      {listLoading ? (
        <p className="admin-empty">Chargement…</p>
      ) : distributionList.length === 0 ? (
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucun adhérent attendu</p>
          <p className="admin-empty-card-note">
            Aucun abonnement actif ne couvre cette date de distribution.
          </p>
        </div>
      ) : visibleList.length === 0 ? (
        /* Distinct du cas ci-dessus : « personne cette semaine » et « personne
           qui corresponde à ma frappe » n’appellent pas la même réaction. */
        <div className="admin-empty-card">
          <p className="admin-empty-card-title">Aucun résultat</p>
          <p className="admin-empty-card-note">Personne ne correspond à «&nbsp;{searchTerm}&nbsp;».</p>
          <button type="button" className="admin-btn-ghost" onClick={() => setSearchTerm('')}>
            Effacer la recherche
          </button>
        </div>
      ) : (
        <div className="admin-distribution-list">
          {visibleList.map((item) => {
            const done = item.pickup?.wasPickedUp || false;
            const fullName = `${item.user.firstName} ${item.user.lastName}`;

            return (
              <article
                key={item.subscriptionId}
                className={`admin-row-card admin-pickup ${done ? 'admin-pickup-done' : ''}`}
              >
                {/* aria-pressed plutôt qu'un simple bouton : l'état coché doit
                    être lisible par un lecteur d'écran, pas seulement par la
                    couleur de la bande. */}
                <button
                  type="button"
                  className={`admin-pickup-toggle ${done ? 'admin-pickup-toggle-done' : ''}`}
                  onClick={() => handleTogglePickup(item)}
                  aria-pressed={done}
                  aria-label={done
                    ? `Annuler le retrait du panier de ${fullName}`
                    : `Marquer le panier de ${fullName} comme remis`}
                >
                  {/* La coche est dessinée par le CSS ; le bouton reste vide,
                      son sens est porté par aria-pressed et aria-label. */}
                </button>

                <div>
                  <p className="admin-pickup-name">{fullName}</p>

                  <div className="admin-pickup-meta">
                    <span className={`admin-badge ${item.basketSize === 'SMALL' ? 'admin-badge-brown' : 'admin-badge-green'}`}>
                      {basketLabel(item.basketSize)}
                    </span>
                    <span>{item.subscriptionNumber}</span>
                    {item.user.phone && <span>{phone(item.user.phone)}</span>}
                    {done && item.pickup?.pickedUpAt && (
                      <span>Remis à {time(item.pickup.pickedUpAt)}</span>
                    )}
                  </div>

                  {item.pickup?.notes && (
                    <p className="admin-pickup-note">{item.pickup.notes}</p>
                  )}
                </div>

                <div className="admin-pickup-actions">
                  <button
                    type="button"
                    className="admin-btn-ghost"
                    onClick={() => setNoteTarget(item)}
                  >
                    {item.pickup?.notes ? 'Modifier la note' : 'Ajouter une note'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {noteTarget && (
        <PickupNoteModal
          item={noteTarget}
          weeklyBasketId={currentBasket.id}
          onClose={handleNoteClosed}
        />
      )}
    </div>
  );
}
