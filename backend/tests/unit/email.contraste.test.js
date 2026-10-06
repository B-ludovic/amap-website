/* Les liens, boutons et mentions d'alerte des emails restent lisibles
   (WCAG AA : 4,5:1 pour un texte courant). */

import { describe, it, expect } from 'vitest';
import { EMAIL_PALETTE as P } from '../../src/services/emailTheme.js';

const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = hex.slice(1).match(/../g).map((c) => lineaire(parseInt(c, 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
};

const AA = 4.5;

describe('Le terracotta des emails', () => {
  it('rend les liens lisibles sur la crème et dans les encadrés sable', () => {
    expect(contraste(P.terracotta, P.page)).toBeGreaterThanOrEqual(AA);
    expect(contraste(P.terracotta, P.sand)).toBeGreaterThanOrEqual(AA);
  });

  it('porte le texte crème des boutons', () => {
    expect(contraste(P.page, P.terracotta)).toBeGreaterThanOrEqual(AA);
  });
});

describe('La mention « en retard » du récapitulatif de trésorerie', () => {
  it('reste lisible sur sa ligne teintée', () => {
    expect(contraste(P.alertText, P.alertBg)).toBeGreaterThanOrEqual(AA);
  });
});
