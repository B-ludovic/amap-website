/* Formatage des dates et des montants, écrit à la main.
   Intl est proscrit : Node et le navigateur ne choisissent pas les mêmes
   caractères d'espace, et l'écart entre le rendu serveur et le rendu client
   déclenche une erreur d'hydratation. Tables en dur, espaces ordinaires. */

export const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(number) {
  return String(number).padStart(2, '0');
}

/* « 14/08/2026 » — colonnes de tableau */
export function numericDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/* « mercredi 19 août 2026 » */
export function longDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/* « Mercredi 19 août » — titre de carte, sans l'année */
export function longDayMonth(value) {
  const date = toDate(value);
  if (!date) return '—';
  const day = DAYS_LONG[date.getDay()];
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/* « 19 août 2026 » */
export function dayMonthYear(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/* « 08/2026 » — ancienneté d'un adhérent */
export function monthYear(value) {
  const date = toDate(value);
  if (!date) return '—';
  return `${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function groupThousands(value) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* « 1 240,00 € » */
export function euro(value) {
  const [whole, cents] = Number(value || 0).toFixed(2).split('.');
  return `${groupThousands(whole)},${cents} €`;
}

/* « 48 320 € » — chiffres de synthèse, sans centimes */
export function euroRound(value) {
  return `${groupThousands(String(Math.round(Number(value) || 0)))} €`;
}

export function plural(count, singular, pluralForm) {
  return Math.abs(count) > 1 ? pluralForm : singular;
}
