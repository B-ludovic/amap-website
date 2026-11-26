/* Un corps de requête refusé par express.json() ressort avec son vrai statut, un
   message lisible, et sans que le corps reçu soit recopié dans les logs. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import express from 'express';
import { reponseFactice } from '../helpers/expressFactice.js';

const { errorHandler } = await import('../../src/middlewares/error.middleware.js');

// La même configuration que server.js.
const analyser = express.json({ limit: '100kb' });

// `complete` sans socket : body-parser tient la requête pour lue et rend la main aussitôt.
const envoyer = (corps, { contentType = 'application/json' } = {}) => new Promise((resolve) => {
  const brut = Buffer.from(corps);
  const req = Object.assign(new PassThrough(), {
    method: 'POST',
    path: '/api/auth/login',
    complete: true,
    headers: { 'content-type': contentType, 'content-length': String(brut.length) },
  });

  req.end(brut);
  analyser(req, {}, (err) => resolve({ req, err }));
});

const repondre = (err, req) => {
  const res = reponseFactice();
  errorHandler(err, req, res, () => {});
  return res;
};

let error;

beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('Corps de requête refusé par express.json()', () => {
  it('laisse passer un JSON valide', async () => {
    const { req, err } = await envoyer('{"email":"marie@exemple.test"}');

    expect(err).toBeUndefined();
    expect(req.body).toEqual({ email: 'marie@exemple.test' });
  });

  it.each([
    ['un JSON malformé', '{"email":', {}, 400, 'Le corps de la requête n\'est pas un JSON valide.'],
    ['un corps au-delà de 100 ko', JSON.stringify({ texte: 'x'.repeat(110 * 1024) }), {}, 413, 'La requête est trop volumineuse.'],
    ['un encodage inconnu', '{}', { contentType: 'application/json; charset=latin1' }, 415, 'Encodage de la requête non pris en charge.'],
  ])('rend %s avec son statut et un message lisible', async (_cas, corps, options, statut, message) => {
    const { req, err } = await envoyer(corps, options);
    const res = repondre(err, req);

    expect(res.statutHttp).toBe(statut);
    expect(res.corps).toEqual({ success: false, error: { message, type: 'RequestBodyError' } });
  });

  it('ne recopie pas le corps reçu dans les logs, mot de passe compris', async () => {
    const { req, err } = await envoyer('{"email":"marie@exemple.test","password":hunter2}');

    expect(err.message).toContain('hunter2');

    repondre(err, req);

    const [intitule, journal] = error.mock.calls[0];
    expect(intitule).toBe('Erreur capturée:');
    expect(journal).toMatchObject({ status: 400, message: 'entity.parse.failed', path: '/api/auth/login' });
    expect(JSON.stringify(error.mock.calls)).not.toContain('hunter2');
    expect(JSON.stringify(error.mock.calls)).not.toContain('marie@');
  });
});
