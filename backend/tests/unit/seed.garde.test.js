/* Le seed destructif ne vise que la base de cette machine, et ne laisse plus de
   mot de passe connu derrière lui. */

import { describe, it, expect } from 'vitest';
import { assertLocalDatabase, drawAdminPassword } from '../../prisma/seedSafety.js';
import { PasswordSchema } from '../../src/utils/validation.schemas.js';

const adresse = (hote) => `postgresql://amap:secret-de-test@${hote}:5432/amap`;

const refus = (databaseUrl, nodeEnv = 'development') => {
  try {
    assertLocalDatabase(databaseUrl, nodeEnv);
  } catch (erreur) {
    return erreur.message;
  }
  return null;
};

describe('Le seed destructif ne vise que cette machine', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'LOCALHOST'])('accepte %s', (hote) => {
    expect(refus(adresse(hote))).toBeNull();
  });

  it('accepte un socket Unix', () => {
    expect(refus('postgresql:///amap?host=/var/run/postgresql')).toBeNull();
  });

  it('refuse une base distante en la nommant, sans répéter les identifiants', () => {
    const message = refus(adresse('dpg-abc123-a.frankfurt-postgres.render.com'));

    expect(message).toContain('dpg-abc123-a.frankfurt-postgres.render.com');
    expect(message).not.toContain('secret-de-test');
  });

  it('refuse un hôte distant glissé dans la chaîne de requête', () => {
    expect(refus('postgresql:///amap?host=base.exemple.org')).toContain('base.exemple.org');
  });

  it('refuse la production, même sur cette machine', () => {
    expect(refus(adresse('localhost'), 'production')).toContain('production');
  });

  it('refuse une adresse absente', () => {
    expect(refus(undefined)).toContain('DATABASE_URL');
  });
});

describe('Le mot de passe admin est tiré à chaque seed', () => {
  it('respecte la règle des mots de passe du site', () => {
    for (let essai = 0; essai < 50; essai += 1) {
      expect(PasswordSchema.safeParse(drawAdminPassword()).success).toBe(true);
    }
  });

  it('change d\'un seed à l\'autre', () => {
    expect(drawAdminPassword()).not.toBe(drawAdminPassword());
  });
});
