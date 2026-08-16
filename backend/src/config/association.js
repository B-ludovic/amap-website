/* L'adresse à laquelle les adhérents écrivent.

   Elle tenait en clair dans six gabarits d'emails et dans l'écran de
   désabonnement. Le jour où l'association change de boîte, chacun de ces
   endroits invite à écrire à une adresse morte — et le formulaire de contact,
   qui poste vers cette même adresse, envoie dans le vide.

   Variable d'environnement plutôt que constante figée : c'est une donnée
   d'exploitation, elle doit pouvoir changer sans qu'on touche au code. Repli
   sur l'adresse actuelle plutôt que refus de démarrer, parce que rien ne se
   perd si elle manque : contact.controller.js enregistre le message en base
   avant de tenter l'envoi, et /admin/messages le montre avec son compteur de
   non-lus. */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'auxptitspois@gmail.com';
