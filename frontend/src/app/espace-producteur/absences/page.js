'use client';

import { useCallback, useEffect, useState } from 'react';
import { useModal } from '../../../contexts/ModalContext';
import api from '../../../lib/api';
import { dayMonthYearLong } from '../../../lib/format';
import { CONTACT_EMAIL } from '../../../constants/association';
import AbsenceForm from '../../../components/producer/AbsenceForm';

// « AAAA-MM-JJ » lu comme un jour du calendrier local, pour qu'aucun fuseau ne décale la date.
const calendarDay = (value) => String(value).slice(0, 10);
const asLocalDate = (day) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
};
const todayDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const periodOf = (absence) =>
  `Du ${dayMonthYearLong(asLocalDate(calendarDay(absence.startDate)))} au ${dayMonthYearLong(asLocalDate(calendarDay(absence.endDate)))}`;

function AbsenceCard({ absence, today, onEdit, onDelete, busy, readOnly }) {
  const ongoing = calendarDay(absence.startDate) <= today && today <= calendarDay(absence.endDate);

  return (
    <article className="pspace-product">
      <div className="pspace-product-head">
        <h3 className="pspace-product-name">{periodOf(absence)}</h3>
        {ongoing && <span className="pspace-product-category">En cours</span>}
      </div>
      {absence.reason && <p className="pspace-product-status">{absence.reason}</p>}
      {!readOnly && (
        <div className="pspace-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit} disabled={busy}>
            Modifier
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onDelete} disabled={busy}>
            Annuler l&apos;absence
          </button>
        </div>
      )}
    </article>
  );
}

export default function ProducerAbsencesPage() {
  const { showConfirm, showSuccess, showError } = useModal();

  const [absences, setAbsences] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.producerSpace.getAbsences()
    .then((response) => {
      setAbsences(response.data.absences);
      setLoadError('');
    })
    .catch((error) => setLoadError(error.message)), []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (action, message) => {
    try {
      await action();
      showSuccess('Absence', message);
      setEditing(null);
      await load();
    } catch (error) {
      showError('Erreur', error.message);
    }
  };

  const remove = (absence) => {
    showConfirm(
      'Annuler l\'absence',
      `${periodOf(absence)} : vos produits reviennent au tirage pour ces dates.`,
      async () => {
        setBusy(true);
        try {
          const response = await api.producerSpace.deleteAbsence(absence.id);
          showSuccess('Absence', response.message);
          await load();
        } catch (error) {
          showError('Erreur', error.message);
        } finally {
          setBusy(false);
        }
      }
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

  const today = todayDay();
  const upcoming = (absences ?? [])
    .filter((absence) => calendarDay(absence.endDate) >= today)
    .sort((a, b) => calendarDay(a.startDate).localeCompare(calendarDay(b.startDate)));
  const past = (absences ?? []).filter((absence) => calendarDay(absence.endDate) < today);

  return (
    <>
      <header className="pspace-head">
        <div className="eyebrow">Espace producteur</div>
        <h1 className="pspace-title">Mes absences</h1>
        <p className="pspace-lede">
          Pendant une absence, vos produits sortent du tirage. Le panier d&apos;un mercredi est tiré le
          jeudi qui précède : une absence déclarée après ne change pas ce panier,{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="pspace-link">prévenez l&apos;AMAP</a>.
        </p>
      </header>

      {editing === 'new' ? (
        <section className="pspace-product is-editing" aria-label="Nouvelle absence">
          <AbsenceForm
            submitLabel="Déclarer l'absence"
            onCancel={() => setEditing(null)}
            onSubmit={(data) => save(() => api.producerSpace.createAbsence(data), 'Absence déclarée')}
          />
        </section>
      ) : (
        <button type="button" className="btn btn-primary btn-lg pspace-submit pspace-add" onClick={() => setEditing('new')}>
          Déclarer une absence
        </button>
      )}

      {absences === null ? (
        <p className="pspace-loading">Chargement…</p>
      ) : (
        <>
          <section className="pspace-section" aria-labelledby="pspace-upcoming">
            <h2 id="pspace-upcoming" className="pspace-section-title">En cours et à venir</h2>
            {upcoming.length === 0 ? (
              <p className="pspace-lede">Aucune absence prévue.</p>
            ) : (
              <div className="pspace-product-list">
                {upcoming.map((absence) => (
                  editing === absence.id ? (
                    <section key={absence.id} className="pspace-product is-editing" aria-label={`Modifier ${periodOf(absence)}`}>
                      <AbsenceForm
                        absence={absence}
                        submitLabel="Enregistrer"
                        onCancel={() => setEditing(null)}
                        onSubmit={(data) => save(() => api.producerSpace.updateAbsence(absence.id, data), 'Absence corrigée')}
                      />
                    </section>
                  ) : (
                    <AbsenceCard
                      key={absence.id}
                      absence={absence}
                      today={today}
                      busy={busy}
                      onEdit={() => setEditing(absence.id)}
                      onDelete={() => remove(absence)}
                    />
                  )
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="pspace-section" aria-labelledby="pspace-past">
              <h2 id="pspace-past" className="pspace-section-title">Passées</h2>
              <div className="pspace-product-list">
                {past.map((absence) => (
                  <AbsenceCard key={absence.id} absence={absence} today={today} readOnly />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
