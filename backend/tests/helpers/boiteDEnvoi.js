/* Un facteur qui ne sort jamais.

   On remplace la fabrique de transporteur, et non sendMail : le service ne sait
   pas qu'il est observé, il compose son HTML exactement comme en production. */

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

/* Fait refuser le prochain envoi, pour rejouer la scène du mardi soir : Brevo
   répond 429, le quota du jour est atteint, et il faut pouvoir dire ensuite
   lesquels des bénévoles ont été prévenus. */
let refusDEnvoi = null;

export function simulerRefusSmtp(message = 'Message rejected: quota exceeded') {
  refusDEnvoi = message;
}

export function retablirSmtp() {
  refusDEnvoi = null;
}

/* Les réglages avec lesquels le service a fabriqué son transporteur — pool,
   délais de garde. Les relire permet de vérifier qu'ils n'ont pas disparu à la
   faveur d'une refonte. */
export const reglagesTransporteur = {};

/* Ce que verra `import nodemailer from 'nodemailer'` une fois le module
   remplacé. La forme compte à deux titres : le service utilise l'export par
   défaut, et il attend un transporteur qui sache aussi se vérifier et se
   fermer. Un double qui n'offrirait que sendMail laisserait passer un appel
   manquant sur les deux autres. */
export const fauxNodemailer = {
  default: {
    createTransport: (options) => {
      Object.assign(reglagesTransporteur, options);

      return {
        sendMail: async (message) => {
          if (refusDEnvoi) throw new Error(refusDEnvoi);

          boiteDEnvoi.push(message);
          return { messageId: 'message-de-test', accepted: [message.to] };
        },
        verify: async () => true,
        close: () => {},
      };
    },
  },
};

/* La table EmailLog, en mémoire.

   Le service écrit une ligne par message — partie ou non — et c'est cette trace
   qui répond après coup à « qui a été prévenu ? ». La tenir ici plutôt que de
   se contenter d'un objet vide permet aux tests de la relire, donc de vérifier
   ce qui compte vraiment : non pas que le code appelle Prisma, mais qu'une
   trace exploitable existe pour chaque envoi. */
export const registreEmails = [];

export function viderRegistre() {
  registreEmails.length = 0;
}

export function tracesDe(kind) {
  return registreEmails.filter((ligne) => ligne.kind === kind);
}

/* Fait échouer la prochaine écriture de trace, pour éprouver le cas « la base
   est tombée mais le message, lui, est bien parti ». */
let panneDeBase = false;

export function simulerPanneDeBase(actif = true) {
  panneDeBase = actif;
}

/* La liste des adresses auxquelles on n'écrit plus, en mémoire. Même rôle que
   registreEmails : les tests la relisent au lieu de vérifier qu'un appel Prisma
   a eu lieu. */
export const registreSuppressions = [];

export function viderSuppressions() {
  registreSuppressions.length = 0;
}

export function ecarterAdresse(email, reason = 'HARD_BOUNCE') {
  const ligne = {
    id: `suppression-${registreSuppressions.length + 1}`,
    email: email.toLowerCase(),
    reason,
    detail: null,
    createdAt: new Date(),
    lastEventAt: new Date(),
  };
  registreSuppressions.push(ligne);

  return ligne;
}

/* Les comptes, réduits à ce que le webhook y touche : l'opposition à la lettre
   d'information. */
export const registreComptes = [];

export function viderComptes() {
  registreComptes.length = 0;
}

export function inscrireCompte(email, { newsletterOptIn = true } = {}) {
  const compte = { id: `compte-${registreComptes.length + 1}`, email, newsletterOptIn, newsletterOptOutAt: null };
  registreComptes.push(compte);

  return compte;
}

const correspond = (ligne, where) => {
  if (where.email?.equals) {
    return String(ligne.email).toLowerCase() === String(where.email.equals).toLowerCase();
  }
  if (where.email) return ligne.email === where.email;

  return true;
};

/* config/database.js instancie un client Prisma dès son import, et le service
   d'emails l'entraîne dans son sillage. Un test unitaire n'a rien à faire avec
   une vraie base : ce double en tient lieu, et n'implémente que ce que le
   service utilise réellement. */
export const fausseBase = {
  prisma: {
    emailLog: {
      create: async ({ data }) => {
        if (panneDeBase) throw new Error('base injoignable');

        const ligne = { id: `trace-${registreEmails.length + 1}`, sentAt: new Date(), ...data };
        registreEmails.push(ligne);

        return ligne;
      },

      updateMany: async ({ where, data }) => {
        const cibles = registreEmails.filter((ligne) => where.messageId?.in?.includes(ligne.messageId));
        cibles.forEach((ligne) => Object.assign(ligne, data));

        return { count: cibles.length };
      },
    },

    emailSuppression: {
      findUnique: async ({ where }) => {
        if (panneDeBase) throw new Error('base injoignable');

        return registreSuppressions.find((ligne) => ligne.email === where.email) ?? null;
      },

      findMany: async ({ where }) =>
        registreSuppressions.filter((ligne) => where?.email?.in?.includes(ligne.email) ?? true),

      upsert: async ({ where, create, update }) => {
        const existante = registreSuppressions.find((ligne) => ligne.email === where.email);

        if (existante) {
          Object.assign(existante, update);
          return existante;
        }

        const ligne = { id: `suppression-${registreSuppressions.length + 1}`, createdAt: new Date(), lastEventAt: new Date(), ...create };
        registreSuppressions.push(ligne);

        return ligne;
      },
    },

    user: {
      updateMany: async ({ where, data }) => {
        const cibles = registreComptes.filter((compte) =>
          correspond(compte, where)
          && (where.newsletterOptIn === undefined || compte.newsletterOptIn === where.newsletterOptIn));

        cibles.forEach((compte) => Object.assign(compte, data));

        return { count: cibles.length };
      },
    },
  },
  connectDB: async () => {},
  disconnectDB: async () => {},
};
