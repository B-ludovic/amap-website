'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import api, { auth as authApi } from '../../lib/api';
import { dayMonthYearLong } from '../../lib/format';
import '../../styles/public/compte.css';

/* Formatage maison plutôt qu'Intl : le rendu doit être identique côté serveur
   et côté navigateur, sans quoi React signale une divergence d'hydratation. */
const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;
const PAUSE_WEEKS_ALLOWED = 2; // le backend plafonne les pauses à 14 jours

const STATUS = {
  ACTIVE: { label: 'Actif', tone: '' },
  PAUSED: { label: 'En pause', tone: ' is-soon' },
  PENDING: { label: 'En attente', tone: ' is-soon' },
  EXPIRED: { label: 'Expiré', tone: ' is-off' },
  CANCELLED: { label: 'Résilié', tone: ' is-off' },
};

const TYPE_LABEL = { ANNUAL: 'Annuel', DISCOVERY: 'Découverte' };
const SIZE_LABEL = { SMALL: 'petit panier', LARGE: 'grand panier' };
const SIZE_WEIGHT = { SMALL: '2 à 4 kg', LARGE: '6 à 8 kg' };
const ROLE_LABEL = { MEMBER: 'Adhérent', VOLUNTEER: 'Bénévole', ADMIN: 'Administrateur' };

/* Le sort de chaque chèque, dit du point de vue de celui qui l'a écrit. Un
   adhérent ne se demande pas dans quel état est une ligne de sa fiche : il se
   demande quand la somme quittera son compte. La phrase répond donc à ça, et la
   date qu'elle porte change de nature selon l'étape — une échéance tant que rien
   n'est parti, un fait accompli ensuite. */
const CHEQUE_PHRASE = {
  RECEIVED: (cheque, date) => `à encaisser le ${date(cheque.dueDate)}`,
  DEPOSITED: (cheque, date) => `remis en banque le ${date(cheque.depositedAt ?? cheque.dueDate)}`,
  SUCCEEDED: (cheque, date) => `encaissé le ${date(cheque.paidAt ?? cheque.dueDate)}`,
  FAILED: () => 'rejeté par la banque — contactez-nous',
  RETURNED: () => 'rendu'
};

/* La maquette pose une quantité à droite de chaque ligne du panier ; le modèle
   de données n'en porte pas (WeeklyBasketItem n'a que le produit). La catégorie
   tient le même rôle : une mention courte, toujours sur une ligne. */
const CATEGORY_LABEL = {
  VEGETABLES: 'Légumes',
  FRUITS: 'Fruits',
  EGGS: 'Œufs',
  GROCERY: 'Épicerie',
};

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* « mer. 19 août » */
function dayMonth(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* « 2 sept. 2025 » */
function dayMonthYear(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/* « Mercredi 2 septembre » */
function longDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* « 12 juillet » */
function dayAndMonth(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/* « 18:15 » → « 18h15 » */
function hourLabel(value) {
  return (value || '').replace(':', 'h');
}

/* Le créneau est saisi en texte libre côté admin (« Mercredi 18h15 - 19h15 »,
   « Chaque mercredi entre 18h15 et 19h15 ») : on n'en garde que les deux heures,
   rendues comme dans la maquette — « 18h15 → 19h15 ». */
function scheduleRange(schedule) {
  if (!schedule) return '';
  const match = schedule.match(/(\d{1,2}\s?h\s?\d{0,2})\s*(?:-|–|—|à|et|→)\s*(\d{1,2}\s?h\s?\d{0,2})/i);
  if (!match) return schedule;
  return `${match[1].replace(/\s/g, '')} → ${match[2].replace(/\s/g, '')}`;
}

function euro(value) {
  const [whole, cents] = Number(value || 0).toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${cents} €`;
}

function plural(count, singular, pluralForm) {
  return count > 1 ? pluralForm : singular;
}

export default function ComptePage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { showError } = useModal();

  const [subscription, setSubscription] = useState(null);
  const [basket, setBasket] = useState(null);
  const [nextShift, setNextShift] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent
  const [exportStatus, setExportStatus] = useState('idle'); // idle | working | ready
  const [contractStatus, setContractStatus] = useState('idle'); // idle | working
  const [deleteStep, setDeleteStep] = useState('idle'); // idle | armed | working

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    async function loadDashboard() {
      // Trois sources indépendantes : l'échec de l'une ne doit pas vider les autres
      const [subRes, basketRes, shiftsRes] = await Promise.allSettled([
        api.subscriptions.getMySubscription(),
        api.weeklyBaskets.getCurrent(),
        api.shifts.getMyShifts(),
      ]);

      if (cancelled) return;

      if (subRes.status === 'fulfilled') setSubscription(subRes.value?.data ?? null);
      if (basketRes.status === 'fulfilled') setBasket(basketRes.value?.data ?? null);

      if (shiftsRes.status === 'fulfilled') {
        const now = Date.now();
        const upcoming = (shiftsRes.value?.data ?? [])
          .filter((volunteer) => volunteer.status === 'CONFIRMED' && toDate(volunteer.shift?.distributionDate) >= now)
          .sort((a, b) => new Date(a.shift.distributionDate) - new Date(b.shift.distributionDate));
        setNextShift(upcoming[0] ?? null);
      }

      setDataLoading(false);
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleResendConfirmation = useCallback(async () => {
    setResendStatus('sending');
    try {
      await authApi.resendConfirmation(user.email);
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
    }
  }, [user]);

  const handleExportData = useCallback(async () => {
    setExportStatus('working');
    try {
      const data = await authApi.exportMe();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mes-donnees-auxptitspois.json';
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus('ready');
    } catch {
      setExportStatus('idle');
    }
  }, []);

  const handleContract = useCallback(async () => {
    if (!subscription) return;
    setContractStatus('working');
    try {
      const url = await api.subscriptions.getContractBlobUrl(subscription.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contrat-${subscription.subscriptionNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showError('Contrat indisponible', "Le contrat n'a pas pu être généré. Réessayez plus tard ou écrivez au collectif.");
    } finally {
      setContractStatus('idle');
    }
  }, [subscription, showError]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleteStep('working');
    try {
      await authApi.deleteMe();
      await logout();
      router.push('/');
    } catch {
      setDeleteStep('armed');
    }
  }, [logout, router]);

  if (loading || !user) {
    return (
      <div className="account-page">
        <section className="container account-head">
          <p className="account-loading">Chargement…</p>
        </section>
      </div>
    );
  }

  /* ---------- Dérivés de l'abonnement ---------- */
  const status = STATUS[subscription?.status] ?? { label: 'Aucun', tone: ' is-off' };
  const start = toDate(subscription?.startDate);
  const end = toDate(subscription?.endDate);
  const totalWeeks = start && end ? Math.max(1, Math.round((end - start) / WEEK_MS)) : null;
  const currentWeek = start && totalWeeks
    ? Math.min(Math.max(Math.ceil((Date.now() - start) / WEEK_MS), 1), totalWeeks)
    : null;
  const progress = totalWeeks ? Math.round((currentWeek / totalWeeks) * 100) : 0;

  /* Les chèques arrivent déjà triés par échéance. Le prochain encaissement est
     le premier que l'association détient encore : ceux qui sont partis en banque
     ne demandent plus rien à l'adhérent. */
  const cheques = subscription?.payments ?? [];
  const prochainEncaissement = cheques.find((cheque) => cheque.status === 'RECEIVED') ?? null;

  const pauses = subscription?.pauses ?? [];
  const pauseDaysUsed = pauses.reduce(
    (sum, pause) => sum + Math.round((new Date(pause.endDate) - new Date(pause.startDate)) / DAY_MS),
    0
  );
  const pauseWeeksUsed = Math.ceil(pauseDaysUsed / 7);
  const pausesLeft = Math.max(0, PAUSE_WEEKS_ALLOWED - pauseWeeksUsed);

  const pickup = subscription?.pickupLocation;
  const nextPickupDate = basket?.distributionDate ?? null;

  const items = basket?.items ?? [];
  const lastRow = Math.floor(Math.max(items.length - 1, 0) / 2);

  const needsVerification = !user.emailVerified && resendStatus !== 'sent';

  return (
    <div className="account-page">

      {/* En-tête et chiffres de la saison */}
      <section className="container account-head">
        <div className="eyebrow">Espace adhérent · {user.firstName} {user.lastName}</div>
        <h1 className="account-title">Mon compte.</h1>

        <div className="account-stats">
          <div className="account-stat">
            <div className="account-label">Abonnement</div>
            <div className={`account-badge${status.tone}`}>
              <span className="account-badge-dot" aria-hidden="true" />
              <span className="account-badge-text">{status.label}</span>
            </div>
          </div>
          <div className="account-stat">
            <div className="account-label">Prochain retrait</div>
            <div className="account-stat-value">{nextPickupDate ? dayMonth(nextPickupDate) : '—'}</div>
          </div>
          <div className="account-stat">
            <div className="account-label">Semaine</div>
            <div className="account-stat-value">{totalWeeks ? `${currentWeek} / ${totalWeeks}` : '—'}</div>
          </div>
          <div className="account-stat">
            <div className="account-label">Pauses restantes</div>
            <div className={`account-stat-value${subscription && pausesLeft === 0 ? ' is-spent' : ''}`}>
              {subscription ? `${pausesLeft} / ${PAUSE_WEEKS_ALLOWED}` : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Vérification de l'adresse email */}
      {needsVerification && (
        <section className="container account-notice-band">
          <div className="account-notice">
            <span className="account-label">Email non vérifié</span>
            <p className="account-notice-text">
              Confirmez votre adresse pour recevoir la composition du panier et les alertes de distribution.
            </p>
            <button
              type="button"
              className="account-notice-btn"
              onClick={handleResendConfirmation}
              disabled={resendStatus === 'sending'}
            >
              {resendStatus === 'sending' ? 'Envoi…' : "Renvoyer l'email"}
            </button>
          </div>
        </section>
      )}

      {resendStatus === 'sent' && (
        <section className="container account-notice-band">
          <div className="account-notice-ok">
            <span className="account-notice-ok-dot" aria-hidden="true" />
            <span className="account-notice-ok-text">
              Email envoyé — cliquez sur le lien reçu pour finir la vérification.
            </span>
          </div>
        </section>
      )}

      <section className="container account-main">

        <div className="account-col">

          {/* Panier de la semaine */}
          {dataLoading && <p className="account-loading">Chargement de votre espace…</p>}

          {!dataLoading && basket && (
            <article className="account-card">
              <div className="account-card-head">
                <h2 className="account-card-title">Le panier de cette semaine</h2>
                <div className="account-live">
                  <span className="live-dot" aria-hidden="true" />
                  <span className="account-live-text">Publié · semaine {basket.weekNumber}</span>
                </div>
              </div>
              <div className="account-basket-body">
                <div>
                  <div className="account-items">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className={`account-item${Math.floor(index / 2) === lastRow ? ' is-last-row' : ''}`}
                      >
                        <span className="account-item-name">
                          {item.product?.name ?? item.customProductName}
                        </span>
                        <span className="account-item-meta">
                          {CATEGORY_LABEL[item.product?.category] ?? 'Panier'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {basket.notes && <p className="account-basket-note">{basket.notes}</p>}
                </div>

                <div className="account-pickup">
                  <Image
                    src="/placeholder/legumes-ete.webp"
                    alt="Légumes de saison du panier"
                    width={232}
                    height={232}
                    className="account-pickup-img"
                  />
                  <div className="account-pickup-body">
                    <div className="account-label">Retrait</div>
                    <div className="account-pickup-when">
                      {dayMonth(basket.distributionDate)}
                      {pickup?.schedule && (
                        <>
                          <br />
                          {scheduleRange(pickup.schedule)}
                        </>
                      )}
                    </div>
                    {pickup && (
                      <div className="account-pickup-where">{pickup.name}, {pickup.city}</div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Abonnement en cours */}
          {!dataLoading && subscription && (
            <article className="account-card">
              <div className="account-card-head">
                <h2 className="account-card-title">Mon abonnement</h2>
                <span className="account-card-note">
                  Contrat {start?.getFullYear()}
                  {end && end.getFullYear() !== start?.getFullYear() ? ` — ${end.getFullYear()}` : ''}
                </span>
              </div>
              <div className="account-sub-body">

                <div className="account-sub-stats">
                  <div className="account-sub-stat">
                    <div className="account-label">Formule</div>
                    <div className="account-sub-formula">
                      {TYPE_LABEL[subscription.type]} · {SIZE_LABEL[subscription.basketSize]}
                    </div>
                    <div className="account-sub-hint">
                      {SIZE_WEIGHT[subscription.basketSize]} · {totalWeeks} semaines
                      {subscription.pricingType === 'SOLIDARITY' ? ' · tarif solidaire' : ''}
                    </div>
                  </div>
                  <div className="account-sub-stat">
                    <div className="account-label">Montant</div>
                    <div className="account-sub-amount">{euro(subscription.price)}</div>
                    <div className="account-sub-hint">
                      {totalWeeks ? `soit ${euro(subscription.price / totalWeeks)} la semaine` : 'sur la saison'}
                    </div>
                  </div>
                  {/* « Reste 888 € » s'affichait ici à quelqu'un qui avait remis
                      son enveloppe le mois précédent : l'espace adhérent ne
                      connaissait que le montant encaissé, pas les chèques
                      détenus. Il dit maintenant ce que l'association a en main
                      et quand le prochain partira en banque — la seule question
                      que se pose celui qui doit provisionner son compte. */}
                  <div className="account-sub-stat">
                    <div className="account-label">Règlement</div>
                    <div className="account-sub-amount">
                      {cheques.length > 0
                        ? `${cheques.length} ${plural(cheques.length, 'chèque', 'chèques')}`
                        : euro(subscription.paidAmount)}
                    </div>
                    <div className="account-sub-hint">
                      {cheques.length === 0
                        ? 'à remettre lors d’une permanence'
                        : prochainEncaissement
                          ? `prochain encaissement le ${dayMonthYearLong(prochainEncaissement.dueDate)}`
                          : 'tous encaissés'}
                    </div>
                  </div>
                </div>

                {cheques.length > 0 && (
                  <div className="account-cheques">
                    <div className="account-label">Vos chèques</div>
                    <ul className="account-cheques-list">
                      {cheques.map((cheque) => (
                        <li key={cheque.id} className="account-cheques-item">
                          <span className="account-cheques-amount">{euro(cheque.amount)}</span>
                          <span className="account-cheques-state">
                            {(CHEQUE_PHRASE[cheque.status] ?? (() => cheque.status))(cheque, dayMonthYearLong)}
                          </span>
                          {cheque.checkNumber && (
                            <span className="account-cheques-number">n° {cheque.checkNumber}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="account-cheques-note">
                      Une suspension de panier ne modifie pas ces montants : l’engagement
                      couvre la saison entière, c’est ce qui permet au producteur de semer
                      à l’avance.
                    </p>
                  </div>
                )}

                <div className="account-progress">
                  <div className="account-progress-head">
                    <span className="account-label">Avancement de la saison</span>
                    <span className="account-progress-count">
                      {currentWeek} sur {totalWeeks} distributions
                    </span>
                  </div>
                  <div
                    className="account-progress-track"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Avancement de la saison"
                  >
                    <div className="account-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="account-progress-foot">
                    <span className="account-progress-date">{dayMonthYear(subscription.startDate)}</span>
                    <span className="account-progress-date">{dayMonthYear(subscription.endDate)}</span>
                  </div>
                </div>

                <div className="account-rows">
                  <div className="account-row">
                    <span className="account-label">Semaines de pause</span>
                    <span className="account-row-value">
                      {pauses.length === 0
                        ? `Aucune pause posée cette saison — vous disposez de ${PAUSE_WEEKS_ALLOWED} semaines.`
                        : `${pauses.map((pause) => `du ${dayAndMonth(pause.startDate)} au ${dayAndMonth(pause.endDate)}`).join(', ')} — ${
                          pausesLeft > 0
                            ? `il vous reste ${pausesLeft} ${plural(pausesLeft, 'semaine', 'semaines')} de pause.`
                            : 'vous avez utilisé vos deux semaines de pause pour cette saison.'
                        }`}
                    </span>
                  </div>
                  <div className="account-row">
                    <span className="account-label">Prochaine permanence</span>
                    <span className="account-row-value">
                      {nextShift
                        ? `${longDate(nextShift.shift.distributionDate)}, ${hourLabel(nextShift.shift.startTime)} → ${hourLabel(nextShift.shift.endTime)}`
                        : 'Aucune permanence inscrite pour le moment.'}
                    </span>
                  </div>
                </div>

                <div className="account-actions">
                  <Link href="/contact" className="btn btn-secondary account-btn">
                    {pausesLeft > 0 ? 'Demander une semaine de pause' : 'Aucune pause disponible'}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary account-btn"
                    onClick={handleContract}
                    disabled={contractStatus === 'working'}
                  >
                    {contractStatus === 'working' ? 'Préparation du PDF…' : 'Télécharger mon contrat'}
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Aucun abonnement en cours */}
          {!dataLoading && !subscription && (
            <article className="account-card">
              <div className="account-card-head">
                <h2 className="account-card-title">Mon abonnement</h2>
                <span className="account-card-note">Aucun contrat en cours</span>
              </div>
              <div className="account-empty">
                <p className="account-empty-text">
                  Vous n&apos;avez pas d&apos;abonnement actif. Les formules se réservent à
                  l&apos;année ou sur trois mois, et une demande passe par le collectif avant
                  d&apos;être validée.
                </p>
                <Link href="/nos-abonnements" className="btn btn-primary account-btn">
                  Voir les formules
                </Link>
              </div>
            </article>
          )}
        </div>

        <div className="account-aside">

          {/* Coordonnées */}
          <article className="account-card">
            <div className="account-card-head">
              <h2 className="account-card-title">Mes informations</h2>
            </div>
            <div className="account-info-body">
              <div className="account-info-row">
                <div className="account-label">Nom complet</div>
                <div className="account-info-value">{user.firstName} {user.lastName}</div>
              </div>
              <div className="account-info-row">
                <div className="account-label">Email</div>
                <div className="account-info-value is-mono">{user.email}</div>
              </div>
              {user.phone && (
                <div className="account-info-row">
                  <div className="account-label">Téléphone</div>
                  <div className="account-info-value is-mono">{user.phone}</div>
                </div>
              )}
              {user.address && (
                <div className="account-info-row">
                  <div className="account-label">Adresse</div>
                  <div className="account-info-value is-address">{user.address}</div>
                </div>
              )}
              <div className="account-info-row">
                <div className="account-label">Rôle</div>
                <span className="account-role">{ROLE_LABEL[user.role] ?? user.role}</span>
              </div>

              <Link href="/contact" className="btn btn-secondary account-btn account-btn-block">
                Modifier mes informations
              </Link>
            </div>
          </article>

          {/* RGPD */}
          <article className="account-card">
            <div className="account-card-head">
              <h2 className="account-card-title">Mes données</h2>
            </div>
            <div className="account-data-body">
              <p className="account-data-text">
                Vous pouvez récupérer une copie de vos données ou supprimer votre compte à tout
                moment (RGPD, articles 17 et 20).
              </p>
              <div className="account-data-actions">
                <button
                  type="button"
                  className="btn btn-secondary account-btn account-btn-block"
                  onClick={handleExportData}
                  disabled={exportStatus === 'working'}
                >
                  {exportStatus === 'working' && 'Préparation du fichier…'}
                  {exportStatus === 'ready' && 'Fichier prêt — mes-donnees.json'}
                  {exportStatus === 'idle' && 'Exporter mes données'}
                </button>

                {deleteStep === 'idle' ? (
                  <button
                    type="button"
                    className="account-btn-danger-ghost"
                    onClick={() => setDeleteStep('armed')}
                  >
                    Supprimer mon compte
                  </button>
                ) : (
                  <div className="account-danger-panel">
                    <p className="account-danger-text">
                      Action irréversible. Votre contrat en cours sera résilié et toutes vos
                      données supprimées.
                    </p>
                    <div className="account-danger-actions">
                      <button
                        type="button"
                        className="account-btn-danger-solid"
                        onClick={handleDeleteAccount}
                        disabled={deleteStep === 'working'}
                      >
                        {deleteStep === 'working' ? 'Suppression…' : 'Oui, supprimer définitivement'}
                      </button>
                      <button
                        type="button"
                        className="account-btn-danger-cancel"
                        onClick={() => setDeleteStep('idle')}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>

          {/* Contact collectif */}
          <article className="account-help">
            <div className="account-label">Besoin d&apos;aide</div>
            <p className="account-help-text">
              Une absence imprévue, un panier non retiré, une question sur le contrat : écrivez au
              collectif, on répond sous 48 h.
            </p>
            <a href="mailto:auxptitspois@gmail.com" className="account-help-mail">
              auxptitspois@gmail.com
            </a>
          </article>
        </div>
      </section>
    </div>
  );
}
