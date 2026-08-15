/* La direction artistique, portée jusque dans la boîte mail.

   Le site est passé au crème et au terracotta ; les emails, eux, étaient restés
   sur le vert et l'Arial des débuts, chacun des dix-huit gabarits recopiant son
   propre bloc <style>. C'est cette recopie qui a fait diverger l'ensemble : une
   couleur changée sur le site n'avait aucun chemin pour arriver ici. Le gabarit
   est donc unique désormais, et les couleurs vivent en un seul endroit.

   Pourquoi des constantes JavaScript et non les variables CSS du site : un
   client mail n'a pas de feuille de style partagée. Chaque message part seul,
   avec tout ce qu'il faut pour s'afficher, et var(--terracotta) n'y désigne
   rien. Les valeurs sont donc recopiées de frontend/src/styles/variables.css —
   c'est le seul endroit du projet où cette duplication est inévitable, et la
   raison pour laquelle elle est concentrée dans ce fichier plutôt qu'éparpillée
   dans dix-huit gabarits.

   Trois contraintes de l'email dictent le reste. Outlook rend le HTML avec le
   moteur de Word : ni dégradé, ni ombre portée, ni coin arrondi — d'où des
   aplats francs, qui tombent d'ailleurs très bien avec une DA dont les angles
   sont déjà presque droits. Gmail retire les @import : les polices du site sont
   donc proposées, jamais exigées, et la pile de repli (Georgia pour le titrage,
   Helvetica pour le texte) est ce que verra la majorité. Et la largeur tient en
   600 pixels, au-delà desquels les clients coupent. */

/* Hébergé plutôt qu'encodé : le base64 pesait 166 ko et faisait tronquer le
   message chez Gmail, qui ne rend de toute façon pas les data: URI. Servi par
   le site et non par l'API, qui peut s'endormir. alt vide : décoratif, le nom
   est écrit juste en dessous. */
const logoTag = () => `<img src="${process.env.FRONTEND_URL}/logo-email.png" alt="" width="64" height="64" style="display:block;margin:0 auto 18px;border:0;">`;

// Reprises telles quelles de frontend/src/styles/variables.css
export const EMAIL_PALETTE = {
  page: '#FAF7F2',          // crème, fond de message
  sand: '#F3EDE3',          // sable, encadrés et pied de page
  forest: '#2D3A29',        // vert forêt, bandeau de tête
  onForest: '#EFEAE0',      // texte sur le bandeau
  onForestMuted: '#A6B39C', // sur-titre sur le bandeau
  white: '#FFFFFF',
  terracotta: '#C85A32',
  terracottaDark: '#A8451F',
  brass: '#8F5F37',         // brun doré : montants, mentions
  gold: '#C8912F',
  leaf: '#83AB44',
  text: '#1F2421',          // noir verdi
  textSecondary: '#4A5148',
  textLight: '#8A8B80',
  borderCard: '#E3DCD0',
  borderSection: '#E7DFD3',
  borderRule: '#DDD3C4',
  attentionBg: '#F8EBD6',   // fond d'un avertissement
  alertBg: '#FBEDE9',
  alertText: '#B23A22',
};

const P = EMAIL_PALETTE;

/* Fraunces et Plus Jakarta Sans sont celles du site ; Georgia et Helvetica
   prennent le relais partout où elles ne chargent pas, c'est-à-dire dans
   Gmail et Outlook. Le choix des replis n'est pas indifférent : Fraunces est
   une serif à fort contraste, Georgia est la serif la plus proche présente sur
   toutes les machines, et la silhouette du message reste la même. */
const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace";

/* Le vocabulaire visuel commun aux dix-huit messages. Les classes portent les
   mêmes noms qu'avant : les gabarits n'ont eu à changer que leur enveloppe. */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');

  body {
    margin: 0;
    padding: 0;
    background-color: ${P.page};
    font-family: ${FONT_BODY};
    font-size: 15px;
    line-height: 1.7;
    color: ${P.textSecondary};
    -webkit-font-smoothing: antialiased;
  }

  .wrapper { background-color: ${P.page}; padding: 32px 16px; }

  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: ${P.white};
    border: 1px solid ${P.borderCard};
    border-radius: 4px;
    overflow: hidden;
  }

  /* Bandeau de tête : aplat forêt, comme la section d'inversion du site */
  .header { background-color: ${P.forest}; padding: 34px 40px; text-align: center; }
  .header img { display: block; margin: 0 auto 18px; }
  .header .eyebrow {
    margin: 0 0 10px;
    font-family: ${FONT_MONO};
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${P.onForestMuted};
  }
  .header h1 {
    margin: 0;
    font-family: ${FONT_DISPLAY};
    font-size: 27px;
    font-weight: 300;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: ${P.onForest};
  }

  /* Le seul trait de couleur vive du message, sous le bandeau */
  .divider { height: 3px; background-color: ${P.terracotta}; font-size: 0; line-height: 0; }

  .content { padding: 36px 40px; }
  .content p { margin: 0 0 16px; }
  .content h2, .content h3 {
    margin: 28px 0 12px;
    font-family: ${FONT_DISPLAY};
    font-weight: 400;
    font-size: 19px;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: ${P.text};
  }
  .content ul, .content ol { margin: 0 0 16px; padding-left: 22px; }
  .content li { margin-bottom: 7px; }
  .content strong { color: ${P.text}; font-weight: 600; }
  .content a { color: ${P.terracotta}; text-decoration: underline; }

  /* Fiche de rappel : abonnement, permanence, chèque */
  .info-box {
    margin: 24px 0;
    padding: 20px 22px;
    background-color: ${P.page};
    border: 1px solid ${P.borderCard};
    border-radius: 4px;
  }
  .info-box h3 { margin-top: 0; }
  .info-box p:last-child { margin-bottom: 0; }

  /* Ce qu'il faut retenir : filet terracotta à gauche, fond sable */
  .highlight {
    margin: 24px 0;
    padding: 18px 22px;
    background-color: ${P.sand};
    border-left: 3px solid ${P.terracotta};
    border-radius: 0 4px 4px 0;
  }
  .highlight h3 { margin-top: 0; }
  .highlight p:last-child { margin-bottom: 0; }

  /* Ce qui demande vigilance : même forme, teinte d'alerte douce */
  .warning, .note {
    margin: 24px 0;
    padding: 16px 20px;
    background-color: ${P.attentionBg};
    border-left: 3px solid ${P.brass};
    border-radius: 0 4px 4px 0;
    color: ${P.text};
  }

  /* Message d'un adhérent, recopié tel qu'il l'a écrit */
  .message-box {
    margin: 20px 0;
    padding: 20px 22px;
    background-color: ${P.page};
    border-left: 3px solid ${P.brass};
    border-radius: 0 4px 4px 0;
    white-space: pre-wrap;
    color: ${P.text};
  }

  /* Une somme se lit d'un coup d'œil : chasse du titrage, brun doré */
  .amount {
    font-family: ${FONT_DISPLAY};
    font-size: 30px;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: ${P.brass};
  }

  .button {
    display: inline-block;
    padding: 14px 26px;
    background-color: ${P.terracotta};
    border: 1px solid ${P.terracotta};
    border-radius: 4px;
    color: ${P.page} !important;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none !important;
  }
  .button-row { margin: 28px 0; text-align: center; }

  /* Panier de la semaine : la seule bordure tiretée de la DA, elle dit
     « contenu variable » mieux qu'une phrase */
  .basket-box {
    margin: 26px 0;
    padding: 24px;
    background-color: ${P.page};
    border: 1px dashed ${P.borderRule};
    border-radius: 4px;
  }
  .basket-title {
    margin: 0 0 4px !important;
    text-align: center;
    font-family: ${FONT_MONO};
    font-size: 10px !important;
    font-weight: 400 !important;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${P.textLight} !important;
  }
  .product-list { list-style: none; margin: 16px 0 0 !important; padding: 0 !important; }
  .product-list li {
    padding: 9px 2px;
    border-bottom: 1px solid ${P.borderSection};
    color: ${P.text};
    margin-bottom: 0;
  }
  .product-list li:last-child { border-bottom: none; }

  /* Remise de chèques du trésorier */
  table.listing { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; }
  table.listing th {
    padding: 10px 12px;
    background-color: ${P.sand};
    border-bottom: 1px solid ${P.borderRule};
    text-align: left;
    font-family: ${FONT_MONO};
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${P.textLight};
  }
  table.listing td { padding: 11px 12px; border-bottom: 1px solid ${P.borderSection}; color: ${P.text}; }
  table.listing tfoot td { border-bottom: none; border-top: 2px solid ${P.borderRule}; }
  .row-late { background-color: ${P.alertBg}; }
  .tag-late { color: ${P.alertText}; font-size: 12px; font-weight: 600; }
  .cell-muted { color: ${P.textLight}; font-size: 12.5px; }

  /* Pied de page : sable, comme celui du site */
  .footer {
    padding: 26px 40px;
    background-color: ${P.sand};
    border-top: 1px solid ${P.borderSection};
    text-align: center;
  }
  .footer p { margin: 0 0 10px; font-size: 12.5px; line-height: 1.6; color: ${P.textLight}; }
  .footer p:last-child { margin-bottom: 0; }
  .footer .footer-name {
    font-family: ${FONT_MONO};
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${P.brass};
  }
  .footer a { color: ${P.brass}; text-decoration: underline; }

  @media only screen and (max-width: 620px) {
    .wrapper { padding: 0; }
    .container { border-left: none; border-right: none; border-radius: 0; }
    .header { padding: 28px 22px; }
    .header h1 { font-size: 23px; }
    .content, .footer { padding: 26px 22px; }
  }
`;

const ADDRESS = 'Aux P\'tits Pois — AMAP Solidaire';
const ADDRESS_LINE = '14, rue du Château, 45300 Yèvre-la-Ville';

/* Le squelette commun. `title` coiffe le bandeau, `content` est le corps propre
   au message, `footerNote` la mention qui change d'un envoi à l'autre — la
   raison pour laquelle ce message précis arrive dans cette boîte précise. */
export function renderEmail({ title, eyebrow = 'AMAP Solidaire', content, footerNote = '' }) {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          ${logoTag()}
          <p class="eyebrow">${eyebrow}</p>
          <h1>${title}</h1>
        </div>
        <div class="divider"></div>
        <div class="content">
${content}
        </div>
        <div class="footer">
          <p class="footer-name">${ADDRESS}</p>
          <p>${ADDRESS_LINE}</p>
          ${footerNote ? `<p>${footerNote}</p>` : ''}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

/* Partie texte du multipart, dérivée du HTML plutôt que rédigée à part : deux
   versions écrites séparément divergent, et c'est toujours la texte — jamais
   relue — qui garde l'ancienne date. Les liens gardent leur adresse, sinon le
   désabonnement promis par le pied de page n'existe plus en texte brut. */
export function emailToText(html) {
  const sansBalises = (fragment) => String(fragment).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  return String(html ?? '')
    .replace(/<!DOCTYPE[^>]*>/gi, ' ')
    .replace(/<(style|script|head|title)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Les liens d'abord : après le retrait des balises, l'adresse serait perdue.
    .replace(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, texte) => {
        const libelle = sansBalises(texte);
        return libelle && libelle !== href ? `${libelle} (${href})` : href;
      }
    )
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li|ul|ol|table|section)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* Un bouton reste un lien : les <button> ne cliquent pas dans un email. */
export function emailButton(href, label) {
  return `<div class="button-row"><a href="${href}" class="button">${label}</a></div>`;
}
