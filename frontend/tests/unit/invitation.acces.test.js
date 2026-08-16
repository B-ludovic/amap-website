import { describe, it, expect } from 'vitest';
import {
  createInviteToken,
  passwordMatches,
  readInviteConfig,
  readInviteToken,
} from '../../src/lib/inviteGate.js';

const SECRET = 'secret-de-test-sans-valeur-hors-de-cette-suite';
const EMAILS = ['bureau@auxptitspois.test', 'tresorerie@auxptitspois.test'];
const MAINTENANT = Date.UTC(2026, 7, 16, 12, 0, 0);

const config = (surcharges = {}) => ({ secret: SECRET, emails: EMAILS, now: MAINTENANT, ...surcharges });

describe('Configuration de la porte', () => {
  it('laisse le site public tant qu\'aucune adresse n\'est invitée', () => {
    expect(readInviteConfig({}).enabled).toBe(false);
    expect(readInviteConfig({ INVITE_EMAILS: '   ,  ,' }).enabled).toBe(false);
  });

  it('ferme, et ne s\'ouvre pas, quand la liste est posée sans mot de passe ni secret', () => {
    const partielle = readInviteConfig({ INVITE_EMAILS: EMAILS[0] });
    expect(partielle.enabled).toBe(true);
    expect(partielle.ready).toBe(false);
  });

  it('normalise la casse et les espaces des adresses invitées', () => {
    const lue = readInviteConfig({
      INVITE_EMAILS: ' Bureau@AuxPtitsPois.test , tresorerie@auxptitspois.test ',
      INVITE_PASSWORD: 'mot-de-passe',
      INVITE_SECRET: SECRET,
    });
    expect(lue.ready).toBe(true);
    expect(lue.emails).toEqual(['bureau@auxptitspois.test', 'tresorerie@auxptitspois.test']);
  });
});

describe('Vérification du mot de passe', () => {
  it('accepte le mot de passe attendu et refuse tout autre', async () => {
    await expect(passwordMatches('sésame', 'sésame', SECRET)).resolves.toBe(true);
    await expect(passwordMatches('sésamé', 'sésame', SECRET)).resolves.toBe(false);
    await expect(passwordMatches('sésame ', 'sésame', SECRET)).resolves.toBe(false);
    await expect(passwordMatches('', 'sésame', SECRET)).resolves.toBe(false);
  });

  it('refuse quand aucun mot de passe n\'est configuré, plutôt que de valider le vide', async () => {
    await expect(passwordMatches('', '', SECRET)).resolves.toBe(false);
    await expect(passwordMatches('sésame', 'sésame', '')).resolves.toBe(false);
  });
});

describe('Laissez-passer', () => {
  it('relit l\'adresse qu\'il porte', async () => {
    const jeton = await createInviteToken('Bureau@AuxPtitsPois.test', SECRET, MAINTENANT);
    await expect(readInviteToken(jeton, config())).resolves.toBe('bureau@auxptitspois.test');
  });

  it('refuse une signature falsifiée', async () => {
    const jeton = await createInviteToken(EMAILS[0], SECRET, MAINTENANT);
    const [charge] = jeton.split('.');
    await expect(readInviteToken(`${charge}.signature-inventee`, config())).resolves.toBeNull();
    await expect(readInviteToken(charge, config())).resolves.toBeNull();
  });

  it('refuse une charge utile remaniée après signature', async () => {
    const jeton = await createInviteToken(EMAILS[0], SECRET, MAINTENANT);
    const signature = jeton.slice(jeton.lastIndexOf('.') + 1);
    const chargeForgee = Buffer.from(
      JSON.stringify({ email: EMAILS[1], exp: Math.floor(MAINTENANT / 1000) + 99999 }),
    ).toString('base64url');
    await expect(readInviteToken(`${chargeForgee}.${signature}`, config())).resolves.toBeNull();
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const jeton = await createInviteToken(EMAILS[0], 'un-autre-secret', MAINTENANT);
    await expect(readInviteToken(jeton, config())).resolves.toBeNull();
  });

  it('refuse un jeton périmé', async () => {
    const jeton = await createInviteToken(EMAILS[0], SECRET, MAINTENANT);
    const trenteEtUnJours = MAINTENANT + 31 * 24 * 60 * 60 * 1000;
    await expect(readInviteToken(jeton, config({ now: trenteEtUnJours }))).resolves.toBeNull();
  });

  it('coupe l\'accès dès que l\'adresse quitte la liste, sans attendre l\'expiration', async () => {
    const jeton = await createInviteToken(EMAILS[0], SECRET, MAINTENANT);
    await expect(readInviteToken(jeton, config({ emails: [EMAILS[1]] }))).resolves.toBeNull();
  });

  it('refuse ce qui n\'est pas un jeton', async () => {
    await expect(readInviteToken(undefined, config())).resolves.toBeNull();
    await expect(readInviteToken('', config())).resolves.toBeNull();
    await expect(readInviteToken('....', config())).resolves.toBeNull();
    await expect(readInviteToken('pas-du-base64.signature', config())).resolves.toBeNull();
  });
});
