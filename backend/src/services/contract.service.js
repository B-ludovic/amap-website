import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
/* Le PDF ne sait ni calculer un prix, ni le découper en chèques, ni l'écrire :
   il importe les trois de la grille tarifaire et se contente d'imprimer. C'est
   ce qui garantit que le contrat signé et le formulaire public énoncent le même
   montant avec les mêmes mots — ces règles vivaient ici, dans le service qui
   fabrique le PDF, elles ne pouvaient donc pas servir au navigateur, qui en
   tenait forcément sa propre version. */
import {
  WEEKLY_PRICE,
  DELIVERED_WEEKS,
  splitPayment,
  formatEuro,
  euroAmount,
  formatInstallments,
} from '../utils/subscriptionPricing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* LANCEMENT DE CHROMIUM

   Le bac à sable de Chromium enferme le moteur de rendu dans un processus aux
   droits réduits : si une faille du moteur est exploitée, elle s'exécute dans
   cette cellule au lieu de courir avec les droits du serveur — c'est-à-dire, ici,
   avec DATABASE_URL, JWT_SECRET et la clé SMTP dans son environnement.

   Le code partait systématiquement avec --no-sandbox, la recette qu'on recopie
   pour faire démarrer Chromium en conteneur. Le risque restait faible, puisque le
   HTML rendu ne vient jamais du dehors : c'est un gabarit local, compilé par
   Handlebars qui échappe par défaut, poussé par setContent et non par une
   navigation. Mais la protection était retirée partout, y compris là où elle
   fonctionne très bien — vérifié en local, le bac à sable rend le même PDF sans
   surcoût mesurable.

   D'où cet ordre de préférence : on démarre protégé, et l'on ne retombe sur le
   mode ouvert que si l'hébergeur refuse le bac à sable, ce que certaines
   plateformes font faute de namespaces utilisateur. Le repli est bruyant, pour
   qu'il se voie dans les logs au lieu de devenir la norme silencieuse.

   Sur un hébergeur dont on sait déjà qu'il le refuse, poser
   PUPPETEER_DISABLE_SANDBOX=true évite de tenter un démarrage voué à l'échec
   avant chaque contrat. */
const SANDBOX_DISABLED_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

async function launchBrowser() {
  if (process.env.PUPPETEER_DISABLE_SANDBOX === 'true') {
    return puppeteer.launch({ headless: 'new', args: SANDBOX_DISABLED_ARGS });
  }

  try {
    return await puppeteer.launch({ headless: 'new' });
  } catch (error) {
    console.warn(
      '[Contrat] Chromium n\'a pas pu démarrer avec son bac à sable, repli sans isolation. ' +
      'Poser PUPPETEER_DISABLE_SANDBOX=true pour éviter cette double tentative. Cause :',
      error.message.split('\n')[0]
    );

    return puppeteer.launch({ headless: 'new', args: SANDBOX_DISABLED_ARGS });
  }
}

class ContractService {
  // Générer le contrat PDF pour un abonnement //
  
  async generateContract(subscription, user, paymentType = '1') {
    const isDev = process.env.NODE_ENV !== 'production';
    try {
      if (isDev) {
        console.log('[DEV] Génération contrat pour subscription ID:', subscription?.id);
      }

      // Lire le template
      const templatePath = path.join(__dirname, '../../templates/contract.html');

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template non trouvé: ${templatePath}`);
      }

      const templateHtml = fs.readFileSync(templatePath, 'utf8');

      // Compiler avec Handlebars
      const template = handlebars.compile(templateHtml);

      // Charger le logo en base64
      const logoPath = path.join(__dirname, '../../../frontend/public/icons/logo.png');
      let logoBase64 = null;
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }

      // Préparer les données
      const data = this.prepareContractData(subscription, user, paymentType);
      if (logoBase64) data.logoBase64 = logoBase64;

      // Générer le HTML
      const html = template(data);

      // Générer le PDF avec Puppeteer
      let browser;
      try {
        browser = await launchBrowser();

        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        await page.setContent(html, { waitUntil: 'load' });

        // Attendre que le contenu soit bien rendu
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '2cm',
            right: '2cm',
            bottom: '2cm',
            left: '2cm'
          },
          preferCSSPageSize: false
        });

        if (isDev) {
          console.log('[DEV] PDF généré, taille:', pdfBuffer.length, 'bytes');
        }

        return pdfBuffer;
      } finally {
        if (browser) await browser.close();
      }
    } catch (error) {
      console.error('Erreur génération contrat:', error.message);
      throw error;
    }
  }

  // Préparer les données pour le template //

  prepareContractData(subscription, user, paymentType = '1') {
    const subscriptionTypeLabel = subscription.type === 'ANNUAL' 
      ? 'Abonnement Annuel' 
      : 'Abonnement Découverte (3 mois)';

    const basketSizeLabel = subscription.basketSize === 'SMALL'
      ? 'Petit panier (2-4 kg)'
      : 'Grand panier (6-8 kg)';

    const basketWeight = subscription.basketSize === 'SMALL'
      ? '2-4 kg'
      : '6-8 kg';

    const pricingTypeLabel = subscription.pricingType === 'SOLIDARITY'
      ? 'Tarif solidaire (20%)'
      : 'Tarif normal (100%)';

    // Semaines livrées et prix du panier : lus dans la grille tarifaire, jamais
    // recopiés ici. Le PDF est le document que les deux parties signent, il ne
    // peut pas annoncer d'autres montants que ceux qui créent le contrat en base.
    const numberOfWeeks = DELIVERED_WEEKS[subscription.type];
    const smallBasketPrice = WEEKLY_PRICE.SMALL;
    const largeBasketPrice = WEEKLY_PRICE.LARGE;

    // Calculs des prix totaux
    const totalSmall = smallBasketPrice * numberOfWeeks;
    const totalLarge = largeBasketPrice * numberOfWeeks;

    /* Le tableau du contrat est une carte de tarifs : il présente les deux
       tailles de panier et les trois modalités, l'adhérent coche sa ligne. D'où
       une phrase par croisement, calculée pour les deux tailles indépendamment
       de la formule finalement choisie.

       Le découpage vient de la grille tarifaire — le PDF n'a pas à savoir
       comment on répartit un montant en chèques, seulement à imprimer le
       résultat — et la mise en phrase est celle de la note solidaire quelques
       lignes plus bas, pour que le document ne change pas d'écriture d'une
       section à l'autre. Trois notations y cohabitaient jusqu'ici : point
       décimal anglais sur une ligne, entier nu sur la suivante, « .00 » inutile
       sur une troisième. Aucun montant ne bouge, seule leur graphie devient
       uniformément française.

       Effet de bord voulu : quand les quatre chèques sont égaux — c'est le cas
       de la Découverte petit panier, 228 € se divisant juste — la phrase dit
       « 4 chèques de 57 € » au lieu d'annoncer un dernier chèque différent qui
       ne l'est pas. */
    const phrase = (total, paymentType) => formatInstallments(splitPayment(total, paymentType));

    const totalSmallText = phrase(totalSmall, '1');
    const totalLargeText = phrase(totalLarge, '1');
    const halfSmallText = phrase(totalSmall, '2');
    const halfLargeText = phrase(totalLarge, '2');

    /* La cellule des quatre chèques est la plus étroite du tableau : on force la
       coupure avant le dernier chèque plutôt que de laisser le navigateur
       trancher où il peut. La note solidaire, elle, est de la prose et n'en veut
       pas — d'où la coupure posée ici et non dans la mise en phrase. */
    const surDeuxLignes = (texte) => texte.replace(' et ', '<br>et ');
    const quarterSmallText = surDeuxLignes(phrase(totalSmall, '4'));
    const quarterLargeText = surDeuxLignes(phrase(totalLarge, '4'));

    /* Part réellement due par l'adhérent, et sa ventilation en chèques.

       Le tableau ci-dessus est la carte de tarifs de l'association : il affiche
       le prix plein des deux tailles de panier, l'adhérent coche sa ligne. Pour
       un contrat solidaire, ce que l'adhérent inscrit sur ses chèques vaut le
       cinquième de ce qui est imprimé en face de sa case, et ce montant-là ne
       figurait nulle part sur le document qu'il signe : la seule mention du
       tarif solidaire était une note de bas de tableau annonçant un pourcentage,
       à charge pour le lecteur de faire la division lui-même devant son chéquier.

       Aucun tarif n'est modifié ici — on énonce un nombre que le serveur
       calculait déjà pour créer l'abonnement, et qu'il gardait pour lui. */
    const memberAmount = euroAmount(subscription.price);
    const memberInstallments = formatInstallments(splitPayment(subscription.price, paymentType));

    /* Année de la saison, déduite de l'abonnement et non écrite dans le gabarit.
       Elle y figurait en dur — « Saison 2026 », « débité début janvier 2026 » —
       à quatre endroits : le premier contrat édité en janvier prochain aurait
       annoncé la saison précédente à un adhérent qui signe la suivante. */
    const contractYear = new Date(subscription.startDate).getFullYear();

    // Nombre de permanences (exemple: 2 permanences par défaut, à adapter selon vos règles)
    const permanences = subscription.type === 'ANNUAL' ? '2 à 3' : '1';

    // Adresse de l'utilisateur
    const address = user.address || 'Non renseignée';

    // Extraire la ville depuis l'adresse (format attendu : "... XXXXX Ville")
    let contractCity = 'Non renseignée';
    if (user.address) {
      const cityMatch = user.address.match(/\d{5}\s+(.+)$/);
      if (cityMatch) {
        contractCity = cityMatch[1].trim();
      }
    }

    return {
      // Informations utilisateur
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || 'Non renseigné',
      address: address,

      // Informations abonnement
      subscriptionNumber: subscription.subscriptionNumber,
      subscriptionTypeLabel,
      basketSizeLabel,
      basketWeight,
      pricingTypeLabel,
      price: subscription.price.toFixed(2),
      startDate: new Date(subscription.startDate).toLocaleDateString('fr-FR'),
      endDate: new Date(subscription.endDate).toLocaleDateString('fr-FR'),
      numberOfWeeks: numberOfWeeks,

      // Permanences
      permanences: permanences,

      // Année de la saison, reprise dans l'en-tête et dans le calendrier des
      // encaissements du tableau de règlement
      contractYear: contractYear,

      // Prix et paiements
      smallBasketPrice: formatEuro(smallBasketPrice),
      largeBasketPrice: formatEuro(largeBasketPrice),
      totalSmallText: totalSmallText,
      totalLargeText: totalLargeText,
      halfSmallText: halfSmallText,
      halfLargeText: halfLargeText,
      quarterSmallText: quarterSmallText,
      quarterLargeText: quarterLargeText,

      // Part de l'adhérent, à afficher pour lever l'ambiguïté du tarif solidaire
      memberAmount: memberAmount,
      memberInstallments: memberInstallments,

      // Point de retrait
      pickupLocationName: subscription.pickupLocation.name,
      pickupLocationAddress: subscription.pickupLocation.address + ', ' + 
        subscription.pickupLocation.postalCode + ' ' + subscription.pickupLocation.city,
      pickupSchedule: subscription.pickupLocation.schedule,

      // Dates de non-livraison (optionnel)
      hasNonDeliveryDates: false,
      nonDeliveryInfo: '',

      // Conditions booléennes pour Handlebars
      isAnnual: subscription.type === 'ANNUAL',
      isSmallBasket: subscription.basketSize === 'SMALL',
      isSolidarity: subscription.pricingType === 'SOLIDARITY',
      isPayment1: paymentType === '1',
      isPayment2: paymentType === '2',
      isPayment4: paymentType === '4',

      // Date du jour et ville de signature
      contractDate: new Date().toLocaleDateString('fr-FR'),
      contractCity: contractCity
    };
  }
}

export default new ContractService();