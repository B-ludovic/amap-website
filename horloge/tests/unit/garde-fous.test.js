/* Les garde-fous de l'horloge, passés par `npm run deploy` avant tout
   déploiement. Un cron plus fréquent qu'une fois par heure épuiserait les heures
   gratuites de Render ; une adresse publique laisserait n'importe qui lancer le
   Worker ; une nouvelle tentative en boucle multiplierait les réveils. */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../src/index.js';

const config = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');

// Lignes actives seulement : un réglage commenté ne compte pas.
const lignes = config
  .split('\n')
  .map((ligne) => ligne.replace(/#.*$/, '').trim())
  .filter(Boolean);

const valeur = (cle) => lignes.find((ligne) => ligne.startsWith(`${cle} `) || ligne.startsWith(`${cle}=`))
  ?.split('=')[1].trim();

describe('Le déclencheur part une fois par heure, ni plus ni moins', () => {
  it('une seule ligne crons, écrite sur une ligne', () => {
    // Toute mention compte, y compris dans une table en ligne : triggers = { crons = [...] }.
    const declarations = lignes.filter((ligne) => ligne.includes('crons'));

    assert.equal(declarations.length, 1);
    assert.match(declarations[0], /^crons\s*=\s*\[[^\]]*\]$/);
  });

  it('une seule expression, à minute fixe, toutes les heures', () => {
    const declaration = lignes.find((ligne) => /^crons\s*=/.test(ligne));
    const expressions = [...declaration.matchAll(/"([^"]*)"/g)].map(([, expression]) => expression);

    assert.equal(expressions.length, 1);

    const [minute, ...reste] = expressions[0].trim().split(/\s+/);
    assert.match(minute, /^([0-9]|[1-5][0-9])$/, 'la minute doit être un nombre fixe : ni *, ni */n, ni liste');
    assert.deepEqual(reste, ['*', '*', '*', '*']);
  });

  it('aucun environnement secondaire ne redéfinit les réglages', () => {
    assert.ok(!lignes.some((ligne) => ligne.startsWith('[env.')));
  });
});

describe('Aucune entrée publique', () => {
  it('ni adresse workers.dev ni adresse de prévisualisation', () => {
    assert.equal(valeur('workers_dev'), 'false');
    assert.equal(valeur('preview_urls'), 'false');
  });

  it('aucune route ne mène au Worker', () => {
    assert.ok(!lignes.some((ligne) => /^routes?\s*=/.test(ligne) || ligne === '[[routes]]'));
  });

  it('le Worker ne répond à aucune requête HTTP', () => {
    assert.equal(worker.fetch, undefined);
  });
});

describe('Un passage, un appel', () => {
  const ENV = { API_URL: 'https://api.exemple.test/api', JOBS_SECRET: 'secret-de-test' };
  const fetchOriginal = globalThis.fetch;
  const logOriginal = console.log;
  let appels;
  let statut;

  beforeEach(() => {
    appels = [];
    statut = 200;
    globalThis.fetch = async (url, init) => {
      appels.push({ url, init });
      return new Response('{"success":true}', { status: statut });
    };
    console.log = () => {};
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    console.log = logOriginal;
  });

  it('poste une seule fois sur la route des jobs, secret en en-tête', async () => {
    await worker.scheduled({}, ENV);

    assert.equal(appels.length, 1);
    assert.equal(appels[0].url, 'https://api.exemple.test/api/jobs/tick');
    assert.equal(appels[0].init.method, 'POST');
    assert.equal(appels[0].init.headers.authorization, 'Bearer secret-de-test');
  });

  it('signale une réponse en échec sans retenter', async () => {
    statut = 500;

    await assert.rejects(worker.scheduled({}, ENV), /500/);
    assert.equal(appels.length, 1);
  });

  it('ne réveille pas Render quand le secret manque', async () => {
    await assert.rejects(worker.scheduled({}, { API_URL: ENV.API_URL }), /JOBS_SECRET/);
    assert.equal(appels.length, 0);
  });
});
