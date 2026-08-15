function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/* Le nonce reste optionnel : sans 'unsafe-inline', certains navigateurs
   bloquent aussi les blocs script non exécutables. Le passer quand on est dans
   un composant serveur évite le bruit en console.

   suppressHydrationWarning est ici obligatoire, et non un pansement : dès que la
   CSP est appliquée, le navigateur vide la valeur visible de l'attribut nonce
   tout en gardant la vraie dans element.nonce. C'est une protection de la spec
   CSP, sans quoi un sélecteur CSS du type script[nonce^="a"] permettrait de
   deviner le nonce lettre par lettre. React, lui, relit l'attribut vidé pendant
   l'hydratation, le compare à la valeur rendue par le serveur et signale un
   décalage qui n'en est pas un. Les balises de next/script échappent au problème
   parce que Next les injecte côté client au lieu de les hydrater. */
export default function JsonLd({ data, nonce }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
