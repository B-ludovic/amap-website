import { describe, it, expect } from 'vitest';
import { CONSENT_COOKIE, readAnalyticsConsent } from '../../src/lib/consent.js';

/* Même encodage que vanilla-cookieconsent : JSON passé par encodeURIComponent */
const cookie = (valeur) => `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(valeur))}`;

const choix = (categories) => cookie({
  categories,
  revision: 0,
  data: null,
  consentTimestamp: '2026-11-26T10:00:00.000Z',
  consentId: '6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f',
  services: { necessary: [], analytics: [] },
  languageCode: 'fr',
  lastConsentTimestamp: '2026-11-26T10:00:00.000Z',
});

describe('Lecture du choix « mesure d\'audience »', () => {
  it('lit un accord', () => {
    expect(readAnalyticsConsent(choix(['necessary', 'analytics']))).toBe(true);
  });

  it('lit un refus', () => {
    expect(readAnalyticsConsent(choix(['necessary']))).toBe(false);
  });

  it('trouve le cookie parmi les autres', () => {
    const entete = `auth_known=1; ${choix(['necessary', 'analytics'])}; _ga=GA1.1.123.456`;
    expect(readAnalyticsConsent(entete)).toBe(true);
  });

  it('ne dit rien tant qu\'aucun choix n\'est enregistré', () => {
    expect(readAnalyticsConsent('')).toBeNull();
    expect(readAnalyticsConsent('auth_known=1; _ga=GA1.1.123.456')).toBeNull();
  });

  it('ignore un cookie dont le nom commence seulement pareil', () => {
    const voisin = `${CONSENT_COOKIE}-ancien=${encodeURIComponent(JSON.stringify({ categories: ['analytics'] }))}`;
    expect(readAnalyticsConsent(voisin)).toBeNull();
  });

  it('tient pour absent un cookie laissé par Orejime', () => {
    expect(readAnalyticsConsent(cookie({ 'google-analytics': true }))).toBeNull();
  });

  it('tient pour absent un cookie illisible', () => {
    expect(readAnalyticsConsent(`${CONSENT_COOKIE}=pas-du-json`)).toBeNull();
    expect(readAnalyticsConsent(`${CONSENT_COOKIE}=%E0%A4%A`)).toBeNull();
  });
});
