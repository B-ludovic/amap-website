import { describe, it, expect } from 'vitest';
import { organizationJsonLd, pickupPlaceJsonLd } from '../../src/constants/structuredData';

/* Le siège de l'association est dans le Loiret, la distribution a lieu à
   Clamart. Confondre les deux renvoie l'AMAP dans le mauvais département aux
   yeux des moteurs, et la rend introuvable pour ses propres adhérents. Ces
   tests tiennent la frontière entre les deux adresses. */
describe('données structurées — ancrage géographique', () => {
  it("publie l'adresse du point de retrait, pas celle du siège", () => {
    expect(organizationJsonLd.address.addressLocality).toBe('Clamart');
    expect(organizationJsonLd.address.postalCode).toBe('92140');
    expect(JSON.stringify(organizationJsonLd)).not.toContain('45300');
    expect(JSON.stringify(organizationJsonLd)).not.toContain('Yèvre');
  });

  it('déclare la zone desservie, sans quoi un code postal seul ne dit rien', () => {
    const communes = organizationJsonLd.areaServed.map(city => city.name);
    expect(communes).toContain('Clamart');
    expect(communes.length).toBeGreaterThan(1);
    organizationJsonLd.areaServed.forEach(city => {
      expect(city['@type']).toBe('City');
    });
  });

  it('donne les coordonnées et le créneau de distribution', () => {
    expect(organizationJsonLd.geo.latitude).toBeCloseTo(48.8, 1);
    expect(organizationJsonLd.geo.longitude).toBeCloseTo(2.27, 1);
    expect(organizationJsonLd.openingHoursSpecification.dayOfWeek).toContain('Wednesday');
    expect(organizationJsonLd.openingHoursSpecification.opens).toBe('18:15');
    expect(organizationJsonLd.openingHoursSpecification.closes).toBe('19:15');
  });

  it('nomme le lieu de distribution et le relie à l\'association', () => {
    expect(pickupPlaceJsonLd['@type']).toBe('Place');
    expect(pickupPlaceJsonLd.name).toContain('Saint François de Sales');
    expect(organizationJsonLd.location['@id']).toBe(pickupPlaceJsonLd['@id']);
  });

  it('reste sérialisable sans caractère capable de fermer la balise script', () => {
    const serialized = JSON.stringify([organizationJsonLd, pickupPlaceJsonLd]);
    expect(serialized).not.toContain('</script');
  });
});
