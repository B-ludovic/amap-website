// Le job de rétention purge la base entière où il tourne : seule une base *_test est acceptée.
export function adresseBaseDeTest(adresse) {
  const nom = new URL(adresse).pathname.slice(1);
  if (!nom.endsWith('_test')) {
    throw new Error(`Base refusée pour les tests d'intégration : « ${nom} » ne finit pas par _test.`);
  }
  return adresse;
}
