import { readdir } from 'node:fs/promises';
import pg from 'pg';

const ADRESSE_PAR_DEFAUT = 'postgresql://localhost:5432/amap_test?schema=public';
const MIGRATIONS = new URL('../../prisma/migrations/', import.meta.url);

// Le job de rétention purge la base entière où il tourne : seule une base *_test est acceptée.
export function adresseBaseDeTest(adresse = process.env.TEST_DATABASE_URL ?? ADRESSE_PAR_DEFAUT) {
  const nom = new URL(adresse).pathname.slice(1);
  if (!nom.endsWith('_test')) {
    throw new Error(`Base refusée pour les tests d'intégration : « ${nom} » ne finit pas par _test.`);
  }
  return adresse;
}

// globalSetup : la suite refuse de tourner sur une base en retard d'une migration.
export async function setup() {
  const attendues = (await readdir(MIGRATIONS, { withFileTypes: true }))
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name);

  const client = new pg.Client({ connectionString: adresseBaseDeTest() });
  let appliquees;
  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    appliquees = new Set(rows.map((ligne) => ligne.migration_name));
  } catch (erreur) {
    throw new Error(`Base de test injoignable ou jamais migrée (${erreur.code ?? erreur.message}). Voir tests/README.md.`);
  } finally {
    await client.end().catch(() => {});
  }

  const manquantes = attendues.filter((nom) => !appliquees.has(nom));
  if (manquantes.length) {
    throw new Error(`Base de test en retard de ${manquantes.length} migration(s) : ${manquantes.join(', ')}. Voir tests/README.md.`);
  }
}
