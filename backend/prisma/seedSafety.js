import { randomBytes } from 'crypto';
import { PasswordSchema } from '../src/utils/validation.schemas.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '']);

/* seed.js vide toutes les tables : il ne s'exécute que sur une base de cette
   machine, et jamais en production. */
export function assertLocalDatabase(databaseUrl, nodeEnv) {
  if (nodeEnv === 'production') {
    throw new Error('Seed destructif refusé : NODE_ENV vaut production.');
  }

  let host;
  try {
    const url = new URL(databaseUrl);
    // L'hôte peut aussi venir de la chaîne de requête : socket Unix ou hôte explicite.
    host = (url.hostname || url.searchParams.get('host') || '').toLowerCase();
  } catch {
    throw new Error('Seed destructif refusé : DATABASE_URL absente ou illisible.');
  }

  if (!LOCAL_HOSTS.has(host) && !host.startsWith('/')) {
    throw new Error(`Seed destructif refusé : la base est sur « ${host} », pas sur cette machine.`);
  }
}

// Tiré jusqu'à respecter la règle des mots de passe du site.
export function drawAdminPassword() {
  let password;
  do {
    password = randomBytes(18).toString('base64url');
  } while (!PasswordSchema.safeParse(password).success);

  return password;
}
