import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WEEKLY_PRICE, DELIVERED_WEEKS, splitPayment } from '../utils/subscriptionPricing.js';

/* Écriture française d'un montant, telle qu'elle figurait en dur dans le
   gabarit : « 19 » sans décimale inutile, « 29,80 » avec la virgule. */
const formatEuro = (value) => (
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
);

/* Insécable écrite en échappement et non collée telle quelle dans la source :
   un caractère invisible dans le code est un caractère qu'on finit par perdre à
   la première copie. Elle empêche le symbole € de partir seul à la ligne. */
const NBSP = '\u00A0';
const euroAmount = (value) => `${formatEuro(value)}${NBSP}€`;

/* Énoncé d'un échelonnement en toutes lettres : « 3 chèques de 73 € et 1 chèque
   de 73,04 € ». Les chèques de même montant sont regroupés, si bien que seul le
   dernier se détache lorsqu'il porte le reliquat, et qu'un règlement en une
   fois donne simplement « 1 chèque de 292,04 € ». */
const formatInstallments = (amounts) => {
  const groups = [];

  for (const amount of amounts) {
    const previous = groups[groups.length - 1];
    if (previous && previous.amount === amount) previous.count += 1;
    else groups.push({ amount, count: 1 });
  }

  return groups
    .map(({ amount, count }) => `${count} chèque${count > 1 ? 's' : ''} de ${euroAmount(amount)}`)
    .join(' et ');
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

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

    const totalSmallPrice = totalSmall.toFixed(2);
    const totalLargePrice = totalLarge.toFixed(2);

    /* Le fractionnement vient de la grille tarifaire, au même titre que le prix :
       le PDF n'a pas à savoir comment on répartit un montant en chèques, il n'a
       qu'à imprimer le résultat.

       Le tableau du contrat est une carte de tarifs — il présente les deux
       tailles de panier et les trois modalités, l'adhérent coche sa ligne. D'où
       le fractionnement calculé pour les deux tailles, indépendamment de la
       formule choisie. */

    // Paiement en 2 fois. Le gabarit n'affiche qu'un montant, « 2 chèques de X »,
    // ce qui suppose les deux moitiés égales — vrai pour toute la grille
    // actuelle. Si un prix devenait indivisible au centime, c'est le gabarit
    // qu'il faudrait ouvrir, pas ce calcul : la ventilation, elle, reste juste.
    const [halfSmall] = splitPayment(totalSmall, '2');
    const [halfLarge] = splitPayment(totalLarge, '2');
    const halfSmallPrice = halfSmall.toFixed(2);
    const halfLargePrice = halfLarge.toFixed(2);

    // Paiement en 4 fois (3 chèques identiques + 1 chèque ajusté)
    const [quarterSmall, , , lastSmall] = splitPayment(totalSmall, '4');
    const [quarterLarge, , , lastLarge] = splitPayment(totalLarge, '4');
    const lastQuarterSmall = lastSmall.toFixed(2);
    const lastQuarterLarge = lastLarge.toFixed(2);

    const quarterPaymentSmallText = `3 chèques de ${quarterSmall}€<br>et 1 chèque de ${lastQuarterSmall}€`;
    const quarterPaymentLargeText = `3 chèques de ${quarterLarge}€<br>et 1 chèque de ${lastQuarterLarge}€`;

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

      // Prix et paiements
      smallBasketPrice: formatEuro(smallBasketPrice),
      largeBasketPrice: formatEuro(largeBasketPrice),
      totalSmallPrice: totalSmallPrice,
      totalLargePrice: totalLargePrice,
      halfSmallPrice: halfSmallPrice,
      halfLargePrice: halfLargePrice,
      quarterPaymentSmallText: quarterPaymentSmallText,
      quarterPaymentLargeText: quarterPaymentLargeText,

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