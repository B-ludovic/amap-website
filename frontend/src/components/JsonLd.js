function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/* Le nonce reste optionnel : sans 'unsafe-inline', certains navigateurs
   bloquent aussi les blocs script non exécutables. Le passer quand on est dans
   un composant serveur évite le bruit en console. */
export default function JsonLd({ data, nonce }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
