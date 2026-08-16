import { NextResponse } from 'next/server';
import {
  INVITE_COOKIE,
  INVITE_MAX_AGE_SECONDS,
  createInviteToken,
  normalizeEmail,
  passwordMatches,
  readInviteConfig,
} from '../../../lib/inviteGate';

/* Un seul message pour les deux échecs possibles : dire « adresse inconnue »
   révélerait quelles adresses figurent sur la liste. */
const REFUS = 'Adresse ou mot de passe incorrect.';

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/* Compteur d'essais tenu en mémoire : il ne survit ni au redéploiement ni au
   passage sur une autre instance serverless. C'est un ralentisseur, pas une
   serrure — celle-ci reste la longueur du mot de passe. */
const attempts = new Map();

function throttled(key, now) {
  const record = attempts.get(key);

  if (!record || now - record.since > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { since: now, count: 1 });
    return false;
  }

  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || 'inconnu';
}

export async function POST(request) {
  const invite = readInviteConfig();

  if (!invite.enabled) {
    return NextResponse.json({ message: 'Le site est ouvert à tous.' }, { status: 404 });
  }

  if (!invite.ready) {
    return NextResponse.json(
      { message: "L'accès sur invitation est incomplet : prévenez l'administrateur du site." },
      { status: 503 },
    );
  }

  const now = Date.now();
  if (throttled(clientKey(request), now)) {
    return NextResponse.json(
      { message: 'Trop de tentatives. Réessayez dans une dizaine de minutes.' },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: REFUS }, { status: 401 });
  }

  const email = normalizeEmail(body?.email);
  const knownEmail = invite.emails.includes(email);

  /* Le mot de passe est vérifié même quand l'adresse est inconnue : sinon la
     réponse revient plus vite pour une adresse absente de la liste, et le
     temps de réponse devient un test d'appartenance. */
  const goodPassword = await passwordMatches(body?.password, invite.password, invite.secret);

  if (!knownEmail || !goodPassword) {
    return NextResponse.json({ message: REFUS }, { status: 401 });
  }

  const response = NextResponse.json({ email });
  response.cookies.set({
    name: INVITE_COOKIE,
    value: await createInviteToken(email, invite.secret, now),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: INVITE_MAX_AGE_SECONDS,
  });

  return response;
}
