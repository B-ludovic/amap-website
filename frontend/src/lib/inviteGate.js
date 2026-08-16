/* Porte d'invitation : configuration, laissez-passer signé, vérification.

   Web Crypto exclusivement. Ce module est lu par le middleware, qui tourne sur
   le runtime edge, et par le Route Handler, qui tourne sur Node : `node:crypto`
   et `Buffer` ne sont pas disponibles des deux côtés, `crypto.subtle`, `btoa` et
   `atob` le sont. */

export const INVITE_COOKIE = 'inviteAccess';
export const INVITE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

/* La porte s'ouvre et se ferme par la seule présence d'INVITE_EMAILS : liste
   absente ou vide, le site est public. Une liste posée sans mot de passe ni
   secret ne laisse entrer personne — une configuration à moitié faite ferme,
   elle n'ouvre pas. */
export function readInviteConfig(env = process.env) {
  const emails = String(env.INVITE_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  const password = String(env.INVITE_PASSWORD ?? '');
  const secret = String(env.INVITE_SECRET ?? '');

  return {
    enabled: emails.length > 0,
    ready: emails.length > 0 && password.length > 0 && secret.length > 0,
    emails,
    password,
    secret,
  };
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toBase64Url(new Uint8Array(signature));
}

export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/* Les deux mots de passe sont d'abord passés au HMAC, puis comparés. On compare
   ainsi deux empreintes de longueur fixe et imprévisibles : la durée de la
   boucle ne dit plus rien du nombre de caractères devinés. */
export async function passwordMatches(candidate, expected, secret) {
  if (!expected || !secret) return false;
  const [left, right] = await Promise.all([
    sign(String(candidate ?? ''), secret),
    sign(expected, secret),
  ]);
  return constantTimeEqual(left, right);
}

export async function createInviteToken(email, secret, now = Date.now()) {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        email: normalizeEmail(email),
        exp: Math.floor(now / 1000) + INVITE_MAX_AGE_SECONDS,
      }),
    ),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

/* Renvoie l'adresse portée par le laissez-passer, ou null. L'appartenance à la
   liste est revérifiée à chaque requête et non au seul moment de l'entrée :
   retirer une adresse d'INVITE_EMAILS coupe l'accès sans attendre l'expiration. */
export async function readInviteToken(token, { secret, emails, now = Date.now() }) {
  if (typeof token !== 'string' || !secret) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!constantTimeEqual(await sign(payload, secret), signature)) return null;

  let claims;
  try {
    claims = JSON.parse(decoder.decode(fromBase64Url(payload)));
  } catch {
    return null;
  }

  if (!Number.isFinite(claims?.exp) || claims.exp * 1000 <= now) return null;

  const email = normalizeEmail(claims.email);
  if (!email || !emails.includes(email)) return null;

  return email;
}
