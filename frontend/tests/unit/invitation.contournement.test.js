import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { bypassedGate, readInviteConfig } from '../../src/lib/inviteGate.js';
import { proxy } from '../../src/proxy.js';

const FERMEE = readInviteConfig({ INVITE_EMAILS: 'bureau@auxptitspois.test' });
const OUVERTE = readInviteConfig({});

describe('Rendu qui a contourné le proxy', () => {
  it('est repéré à l\'absence de nonce quand la porte est fermée', () => {
    expect(bypassedGate(new Headers(), FERMEE)).toBe(true);
    expect(bypassedGate(new Headers({ 'x-nonce': 'abc' }), FERMEE)).toBe(false);
  });

  it('ne change rien tant que le site est public', () => {
    expect(bypassedGate(new Headers(), OUVERTE)).toBe(false);
  });
});

// Si le proxy cessait de transmettre x-nonce, porte fermée, tout le site rendrait vide.
describe('Nonce transmis par le proxy', () => {
  const CLES = ['INVITE_EMAILS', 'INVITE_PASSWORD', 'INVITE_SECRET'];
  let initial;

  const nonceTransmis = async chemin => {
    const response = await proxy(new NextRequest(new URL(chemin, 'https://auxptitspois.fr')));
    return response.headers.get('x-middleware-request-x-nonce');
  };

  beforeEach(() => {
    initial = Object.fromEntries(CLES.map(cle => [cle, process.env[cle]]));
    for (const cle of CLES) delete process.env[cle];
  });

  afterEach(() => {
    for (const cle of CLES) {
      if (initial[cle] === undefined) delete process.env[cle];
      else process.env[cle] = initial[cle];
    }
  });

  it('accompagne la page servie à un visiteur arrêté par la porte', async () => {
    process.env.INVITE_EMAILS = 'bureau@auxptitspois.test';
    process.env.INVITE_PASSWORD = 'sésame';
    process.env.INVITE_SECRET = 'secret-de-test-sans-valeur-hors-de-cette-suite';
    expect(await nonceTransmis('/nos-abonnements')).toBeTruthy();
  });

  it('accompagne la page servie quand le site est public', async () => {
    expect(await nonceTransmis('/nos-abonnements')).toBeTruthy();
  });
});
