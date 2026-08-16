/* Les coordonnées publiques de l'association, en un seul endroit.

   L'adresse de contact figurait en clair dans le pied de page, la page de
   contact, les mentions légales, l'espace adhérent, la page producteur et les
   données structurées du référencement. Six fichiers à retrouver le jour d'un
   changement de boîte, et autant d'occasions d'en oublier un.

   La variable est inlinée au build par Next.js : en changer demande un
   redéploiement du site, pas seulement un réglage. C'est acceptable pour une
   donnée qui bouge une fois tous les cinq ans, et le repli garantit qu'une
   variable absente n'affiche jamais « undefined » sur une page publique.
   Le backend lit la sienne dans config/association.js — même nom, même repli. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'auxptitspois@gmail.com';
