/* La boîte d'envoi de test : un facteur qui ne sort jamais.

   Le service d'emails fabrique son transporteur au chargement du module, une
   seule fois, et l'appelle ensuite pour chaque message. On remplace donc la
   fabrique elle-même : le service croit tenir un transporteur Brevo, il tient
   en réalité l'objet ci-dessous, qui range dans un tableau ce qu'on lui demande
   de poster au lieu d'ouvrir une connexion SMTP.

   L'intérêt de cette hauteur d'interception : le service ne sait pas qu'il est
   observé. Il compose son HTML exactement comme en production — même gabarit,
   même pied de page, mêmes mentions — et c'est ce HTML-là que les tests
   examinent, pas une reconstitution. */

export const boiteDEnvoi = [];

export function viderBoite() {
  boiteDEnvoi.length = 0;
}

/* Le dernier message posté, tel que le service l'a remis au transporteur :
   { from, to, subject, html, headers }. */
export function dernierMessage() {
  return boiteDEnvoi[boiteDEnvoi.length - 1];
}

/* Le pied de page seul, débarrassé de son indentation.

   renderEmail range toujours les mentions dans <div class="footer">…</div> ;
   isoler ce bloc évite qu'une assertion réussisse parce que la phrase cherchée
   se trouvait ailleurs, dans le corps du message. */
export function piedDePage(html) {
  const bloc = String(html).split('<div class="footer">')[1];
  if (!bloc) return '';
  return bloc.split('</div>')[0].replace(/\s+/g, ' ').trim();
}

/* Ce que verra `import nodemailer from 'nodemailer'` une fois le module
   remplacé. La forme compte : le service utilise l'export par défaut. */
export const fauxNodemailer = {
  default: {
    createTransport: () => ({
      sendMail: async (options) => {
        boiteDEnvoi.push(options);
        return { messageId: 'message-de-test', accepted: [options.to] };
      },
    }),
  },
};

/* config/database.js instancie un client Prisma dès son import, et le service
   d'emails l'entraîne dans son sillage par newsletterAudience. Un test unitaire
   n'a rien à faire avec une base : on rend ce module inerte. */
export const fausseBase = {
  prisma: {},
  connectDB: async () => {},
  disconnectDB: async () => {},
};
