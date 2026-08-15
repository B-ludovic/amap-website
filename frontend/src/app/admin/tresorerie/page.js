'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../../lib/api';
import { useModal } from '../../../contexts/ModalContext';
import { euro, numericDate, plural, MONTHS } from '../../../lib/format';
import '../../../styles/admin/treasury.css';

/* Mêmes libellés que sur la fiche d'abonnement : le chèque décrit un lieu — la
   pochette du trésorier, la banque, le compte — et il doit porter le même nom
   des deux côtés de l'administration. */
const CHEQUE_STATUS = {
  RECEIVED: { label: 'En main', tone: 'admin-badge-amber' },
  DEPOSITED: { label: 'En banque', tone: 'admin-badge-brown' },
  SUCCEEDED: { label: 'Encaissé', tone: 'admin-badge-green' },
  FAILED: { label: 'Rejeté', tone: 'admin-badge-red' },
  RETURNED: { label: 'Rendu', tone: '' }
};

const NEXT_STEP = {
  RECEIVED: { status: 'DEPOSITED', label: 'Déposer' },
  DEPOSITED: { status: 'SUCCEEDED', label: 'Encaisser' }
};

/* « À traiter » ouvre la page : c'est la question du trésorier quand il s'assoit
   devant. Les encaissés et les rendus restent consultables, mais ils ne sont
   plus de son ressort et n'ont pas à encombrer la liste. */
const FILTERS = [
  { value: 'TODO', label: 'À traiter', match: (c) => c.status === 'RECEIVED' || c.status === 'DEPOSITED' || c.status === 'FAILED' },
  { value: 'LATE', label: 'En retard', match: (c) => c.enRetard },
  { value: 'RECEIVED', label: 'En main', match: (c) => c.status === 'RECEIVED' },
  { value: 'DEPOSITED', label: 'En banque', match: (c) => c.status === 'DEPOSITED' },
  { value: 'SUCCEEDED', label: 'Encaissés', match: (c) => c.status === 'SUCCEEDED' },
  { value: 'FAILED', label: 'Rejetés', match: (c) => c.status === 'FAILED' },
  { value: 'RETURNED', label: 'Rendus', match: (c) => c.status === 'RETURNED' },
  { value: 'ALL', label: 'Tous', match: () => true }
];

const monthKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (value) => {
  const date = new Date(value);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const totalOf = (cheques) => cheques.reduce((somme, cheque) => somme + cheque.amount, 0);

export default function AdminTreasuryPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [cheques, setCheques] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('TODO');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState([]);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.subscriptions.getTreasuryCheques();
      setCheques(response.data.cheques);
      setSummary(response.data.summary);
    } catch (error) {
      showError('Erreur', 'Impossible de charger les chèques.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { charger(); }, [charger]);

  const visibles = useMemo(() => {
    const test = FILTERS.find((f) => f.value === filter)?.match ?? (() => true);
    const terme = search.trim().toLowerCase();

    return cheques.filter((cheque) => (
      test(cheque)
      && (!terme
        || cheque.member.toLowerCase().includes(terme)
        || cheque.subscriptionNumber.toLowerCase().includes(terme)
        || (cheque.checkNumber ?? '').toLowerCase().includes(terme))
    ));
  }, [cheques, filter, search]);

  /* Un mois, une remise : c'est le geste réel du trésorier, qui part à la banque
     avec l'enveloppe du mois. La liste épouse ce découpage plutôt que de dérouler
     trois cents lignes à la file. */
  const mois = useMemo(() => {
    const groupes = new Map();
    for (const cheque of visibles) {
      const cle = monthKey(cheque.dueDate);
      if (!groupes.has(cle)) groupes.set(cle, { cle, label: monthLabel(cheque.dueDate), cheques: [] });
      groupes.get(cle).cheques.push(cheque);
    }
    return [...groupes.values()];
  }, [visibles]);

  /* La sélection ne survit pas à un changement de filtre : garder cochée une
     ligne devenue invisible ferait agir un bouton sur ce que personne ne voit. */
  const selectionVisible = useMemo(
    () => selection.filter((id) => visibles.some((cheque) => cheque.id === id)),
    [selection, visibles]
  );

  const selectionnes = useMemo(
    () => visibles.filter((cheque) => selectionVisible.includes(cheque.id)),
    [visibles, selectionVisible]
  );

  const basculer = (id) => setSelection((precedente) => (
    precedente.includes(id) ? precedente.filter((autre) => autre !== id) : [...precedente, id]
  ));

  const basculerMois = (groupe) => {
    const ids = groupe.cheques.map((cheque) => cheque.id);
    const toutCoche = ids.every((id) => selection.includes(id));
    setSelection((precedente) => (
      toutCoche
        ? precedente.filter((id) => !ids.includes(id))
        : [...new Set([...precedente, ...ids])]
    ));
  };

  /* Un chèque par requête, et non un lot en une seule : chaque mouvement est un
     fait distinct, qui laisse sa propre entrée au journal d'audit et recalcule
     le montant réglé de son contrat. Une remise ratée à mi-parcours laisse donc
     derrière elle un état vrai, pas un demi-lot. */
  const avancerLot = async (source, cible) => {
    const concernes = selectionnes.filter((cheque) => cheque.status === source);
    if (concernes.length === 0) return;

    const verbe = cible === 'DEPOSITED' ? 'déposés en banque' : 'encaissés';

    showConfirm(
      `Marquer ${concernes.length} ${plural(concernes.length, 'chèque', 'chèques')}`,
      `${concernes.length} ${plural(concernes.length, 'chèque sera marqué', 'chèques seront marqués')} ${verbe}, pour un total de ${euro(totalOf(concernes))}. Les adhérents concernés le verront dans leur espace.`,
      async () => {
        setBusy(true);
        let reussis = 0;
        const echecs = [];

        for (const cheque of concernes) {
          try {
            await api.subscriptions.updateCheque(cheque.subscriptionId, cheque.id, { status: cible });
            reussis++;
          } catch (error) {
            echecs.push(`${cheque.member} (${cheque.subscriptionNumber})`);
          }
        }

        setSelection([]);
        await charger();
        setBusy(false);

        if (echecs.length === 0) {
          showSuccess('Remise enregistrée', `${reussis} ${plural(reussis, 'chèque marqué', 'chèques marqués')} ${verbe}.`);
        } else {
          showError(
            'Remise incomplète',
            `${reussis} sur ${concernes.length} ${plural(concernes.length, 'chèque enregistré', 'chèques enregistrés')}. Restent : ${echecs.join(', ')}.`
          );
        }
      }
    );
  };

  const avancerUn = async (cheque) => {
    const pas = NEXT_STEP[cheque.status];
    if (!pas) return;

    setBusy(true);
    try {
      await api.subscriptions.updateCheque(cheque.subscriptionId, cheque.id, { status: pas.status });
      await charger();
    } catch (error) {
      showError('Erreur', error.message);
    } finally {
      setBusy(false);
    }
  };

  const seau = (cle) => summary[cle] ?? { count: 0, amount: 0 };
  const enMain = seau('RECEIVED');
  const enRetard = seau('LATE');
  const enBanque = seau('DEPOSITED');
  const encaisse = seau('SUCCEEDED');
  const rejetes = seau('FAILED');

  const aDeposer = selectionnes.filter((cheque) => cheque.status === 'RECEIVED').length;
  const aEncaisser = selectionnes.filter((cheque) => cheque.status === 'DEPOSITED').length;

  return (
    <div className="admin-treasury">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Trésorerie</h1>
          <p className="admin-title-lead">
            Les chèques de l&apos;association, mois par mois, du plus proche au plus lointain.
          </p>
        </div>
      </div>

      <div className="admin-treasury-tiles">
        <div className="admin-treasury-tile">
          <span className="admin-treasury-tile-label">En main</span>
          <span className="admin-treasury-tile-value">{euro(enMain.amount)}</span>
          <span className="admin-treasury-tile-note">
            {enMain.count} {plural(enMain.count, 'chèque à déposer', 'chèques à déposer')}
          </span>
        </div>

        <div className={`admin-treasury-tile ${enRetard.count > 0 ? 'is-alert' : ''}`}>
          <span className="admin-treasury-tile-label">En retard</span>
          <span className="admin-treasury-tile-value">{euro(enRetard.amount)}</span>
          <span className="admin-treasury-tile-note">
            {enRetard.count === 0
              ? 'Aucune échéance dépassée'
              : `${enRetard.count} ${plural(enRetard.count, 'échéance dépassée', 'échéances dépassées')}`}
          </span>
        </div>

        <div className="admin-treasury-tile">
          <span className="admin-treasury-tile-label">En banque</span>
          <span className="admin-treasury-tile-value">{euro(enBanque.amount)}</span>
          <span className="admin-treasury-tile-note">
            {enBanque.count} {plural(enBanque.count, 'chèque déposé', 'chèques déposés')}
          </span>
        </div>

        <div className="admin-treasury-tile">
          <span className="admin-treasury-tile-label">Encaissé</span>
          <span className="admin-treasury-tile-value">{euro(encaisse.amount)}</span>
          <span className="admin-treasury-tile-note">
            {encaisse.count} {plural(encaisse.count, 'chèque crédité', 'chèques crédités')}
          </span>
        </div>
      </div>

      {rejetes.count > 0 && (
        <div className="admin-treasury-alert">
          <strong>{rejetes.count} {plural(rejetes.count, 'chèque rejeté', 'chèques rejetés')}</strong> pour {euro(rejetes.amount)}.
          Ces montants ne couvrent plus rien : les contrats concernés redeviennent dus d&apos;autant.
          <button type="button" className="admin-btn-link" onClick={() => setFilter('FAILED')}>
            Les afficher
          </button>
        </div>
      )}

      <div className="admin-toolbar-da">
        <label htmlFor="admin-treasury-search" className="sr-only">Rechercher un chèque</label>
        <input
          id="admin-treasury-search"
          type="text"
          className="admin-search-field"
          placeholder="Adhérent, n° de contrat, n° de chèque…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <label htmlFor="admin-treasury-filter" className="sr-only">Filtrer les chèques</label>
        <select
          id="admin-treasury-filter"
          className="admin-select"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <span className="admin-toolbar-count">
          {visibles.length} {plural(visibles.length, 'chèque', 'chèques')} · {euro(totalOf(visibles))}
        </span>
      </div>

      {selectionnes.length > 0 && (
        <div className="admin-treasury-bar">
          <span>
            {selectionnes.length} {plural(selectionnes.length, 'chèque sélectionné', 'chèques sélectionnés')}
            {' · '}
            {euro(totalOf(selectionnes))}
          </span>
          <div className="admin-treasury-bar-actions">
            <button
              type="button"
              className="admin-btn-primary"
              disabled={busy || aDeposer === 0}
              onClick={() => avancerLot('RECEIVED', 'DEPOSITED')}
            >
              Déposer en banque ({aDeposer})
            </button>
            <button
              type="button"
              className="admin-btn-forest"
              disabled={busy || aEncaisser === 0}
              onClick={() => avancerLot('DEPOSITED', 'SUCCEEDED')}
            >
              Marquer encaissés ({aEncaisser})
            </button>
            <button type="button" className="admin-btn-ghost" onClick={() => setSelection([])}>
              Tout décocher
            </button>
          </div>
        </div>
      )}

      <div className="admin-panel admin-treasury-table">
        <div className="admin-table-head">
          {/* Cellule vide et non « sr-only » : .sr-only est en position absolue,
              donc sortie du flux — la grille ne la compte plus comme colonne et
              tout l'en-tête glisse d'un cran vers la gauche. */}
          <span aria-hidden="true" />
          <span>Adhérent</span>
          <span className="admin-cell-right">Montant</span>
          <span>Échéance</span>
          <span className="admin-treasury-number-cell">Chèque</span>
          <span>État</span>
          <span className="admin-cell-right">Action</span>
        </div>

        {loading ? (
          <p className="admin-empty">Chargement…</p>
        ) : mois.length === 0 ? (
          /* Deux vides différents : « le filtre ne trouve rien » et « rien n'a
             encore été saisi ». Servir le premier message le jour de la mise en
             service laisse croire à une panne de filtre. */
          <p className="admin-empty">
            {cheques.length === 0
              ? 'Aucun chèque enregistré pour l’instant. Ils apparaîtront ici dès qu’une remise sera saisie sur un abonnement.'
              : 'Aucun chèque ne correspond à ce filtre.'}
          </p>
        ) : (
          mois.map((groupe) => {
            const ids = groupe.cheques.map((cheque) => cheque.id);
            const toutCoche = ids.every((id) => selection.includes(id));

            return (
              <Fragment key={groupe.cle}>
                {/* Un mois, une remise : c'est l'enveloppe que le trésorier
                    emporte à la banque, d'où la case qui coche le mois entier. */}
                <div className="admin-treasury-month">
                  <label className="admin-treasury-check">
                    <input type="checkbox" checked={toutCoche} onChange={() => basculerMois(groupe)} />
                    <span className="admin-treasury-month-title">{groupe.label}</span>
                  </label>
                  <span className="admin-treasury-month-total">
                    {groupe.cheques.length} {plural(groupe.cheques.length, 'chèque', 'chèques')} · {euro(totalOf(groupe.cheques))}
                  </span>
                </div>

                {groupe.cheques.map((cheque) => {
                  const etat = CHEQUE_STATUS[cheque.status] ?? { label: cheque.status, tone: '' };
                  const pas = NEXT_STEP[cheque.status];

                  return (
                    <div
                      key={cheque.id}
                      className={`admin-table-row ${cheque.enRetard ? 'is-late' : ''}`}
                    >
                      <label className="admin-treasury-check">
                        <input
                          type="checkbox"
                          checked={selection.includes(cheque.id)}
                          onChange={() => basculer(cheque.id)}
                        />
                        <span className="sr-only">Sélectionner le chèque de {cheque.member}</span>
                      </label>

                      <span className="admin-treasury-member">
                        <span className="admin-cell-strong">{cheque.member}</span>
                        <Link href="/admin/abonnements" className="admin-treasury-ref">
                          {cheque.subscriptionNumber}
                        </Link>
                      </span>

                      <span className="admin-treasury-amount">{euro(cheque.amount)}</span>

                      <span className="admin-treasury-date">
                        {numericDate(cheque.dueDate)}
                        {cheque.enRetard && <span className="admin-treasury-late">en retard</span>}
                      </span>

                      <span className="admin-treasury-number admin-treasury-number-cell">
                        {cheque.checkNumber ? `n° ${cheque.checkNumber}` : '—'}
                      </span>

                      <span>
                        <span className={`admin-badge ${etat.tone}`}>{etat.label}</span>
                      </span>

                      <span className="admin-cell-right">
                        {pas ? (
                          <button
                            type="button"
                            className="admin-btn-link"
                            disabled={busy}
                            onClick={() => avancerUn(cheque)}
                          >
                            {pas.label}
                          </button>
                        ) : (
                          <span className="admin-cell-muted">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
