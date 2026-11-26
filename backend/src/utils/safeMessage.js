const isProduction = () => process.env.NODE_ENV === 'production';

/* Un jeton n'a rien à faire dans un journal. Certaines routes en portent un dans
   leur chemin — POST /api/auth/confirm/:token —, si bien qu'une erreur survenant
   là écrirait une clé d'activation valide, en clair, dans des logs qui se
   conservent. Les jetons du projet sont des chaînes hexadécimales de 64
   caractères (crypto.randomBytes(32)) ; on masque tout ce qui y ressemble, sans
   toucher aux identifiants UUID, qui portent des tirets, ne sont pas des secrets
   et servent au diagnostic. */
export const maskTokens = (value) => String(value).replace(/\b[a-f0-9]{32,}\b/gi, '[jeton masqué]');

/* Le message d'une erreur Prisma récite la requête fautive, données comprises.
   Une saisie du formulaire producteur mal typée produit un message qui contient
   le nom, l'adresse e-mail, le téléphone et l'adresse postale du candidat — les
   journaliser reviendrait à recopier le formulaire dans les logs.

   Ces messages ont une forme constante : première ligne l'opération, dernière
   ligne le diagnostic, et les données entre les deux. On ne garde donc que les
   deux extrémités en production, ce qui conserve tout ce qui sert à corriger —
   le modèle, l'opération, le champ fautif, le type attendu — sans une seule
   valeur. En développement le message reste entier : c'est là qu'il est utile,
   et les données y sont des données de test.

   Un refus SMTP, lui, cite l'adresse refusée : toute adresse est masquée en
   production, quelle que soit l'erreur. */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

export const safeMessage = (err) => {
  const message = String(err?.message ?? err);

  if (!isProduction()) return maskTokens(message);

  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean);
  const kept = err?.name?.startsWith('PrismaClient') && lines.length >= 2
    ? `${lines[0]} […] ${lines[lines.length - 1]}`
    : message;

  return maskTokens(kept).replace(EMAIL, '[adresse masquée]');
};
