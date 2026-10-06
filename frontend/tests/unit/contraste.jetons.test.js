/* Le texte posé sur les couleurs de la marque reste lisible (WCAG AA : 4,5:1 pour
   un texte courant). Les valeurs sont lues dans variables.css : retoucher un
   jeton suffit à faire tourner ces vérifications. */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/styles/variables.css', import.meta.url), 'utf8');
const jeton = (nom) => {
  const trouve = css.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`));
  if (!trouve) throw new Error(`Jeton --${nom} introuvable ou non hexadécimal`);
  return trouve[1];
};

const canaux = (hex) => hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255);
const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = canaux(hex).map(lineaire);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
};

// Écart perçu dans l'espace OKLab : sous 0,05, deux couleurs se confondent côte à côte.
const oklab = (hex) => {
  const [r, g, b] = canaux(hex).map(lineaire);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
};
const ecart = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

const AA = 4.5;
const FONDS_CLAIRS = ['surface-page', 'surface-hover', 'surface-sand', 'field-bg', 'white'];

describe('Le terracotta porte du texte lisible', () => {
  it.each(FONDS_CLAIRS)('en lien ou en étiquette sur --%s', (fond) => {
    expect(contraste(jeton('terracotta'), jeton(fond))).toBeGreaterThanOrEqual(AA);
  });

  it('en fond de bouton, sous un texte crème, au repos comme au survol', () => {
    expect(contraste(jeton('surface-page'), jeton('terracotta'))).toBeGreaterThanOrEqual(AA);
    expect(contraste(jeton('surface-page'), jeton('terracotta-dark'))).toBeGreaterThanOrEqual(AA);
  });

  it('au survol d\'un lien, sur la crème et le sable', () => {
    expect(contraste(jeton('terracotta-dark'), jeton('surface-page'))).toBeGreaterThanOrEqual(AA);
    expect(contraste(jeton('terracotta-dark'), jeton('surface-sand'))).toBeGreaterThanOrEqual(AA);
  });
});

describe('Le rouge d\'erreur reste lisible et distinct', () => {
  it.each(['surface-page', 'surface-sand', 'error-bg', 'error-bg-soft'])('sur --%s', (fond) => {
    expect(contraste(jeton('error-text'), jeton(fond))).toBeGreaterThanOrEqual(AA);
    expect(contraste(jeton('error-text-hover'), jeton(fond))).toBeGreaterThanOrEqual(AA);
  });

  it('ne se confond pas avec le terracotta', () => {
    expect(ecart(jeton('error-text'), jeton('terracotta'))).toBeGreaterThanOrEqual(0.05);
  });
});
