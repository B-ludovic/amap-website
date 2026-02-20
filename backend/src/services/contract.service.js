import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContractService {
  // Générer le contrat PDF pour un abonnement //
  
  async generateContract(subscription, user, paymentType = '1') {
    try {
      console.log('=== GÉNÉRATION CONTRAT ===');
      console.log('Subscription:', JSON.stringify(subscription, null, 2));
      console.log('User:', JSON.stringify(user, null, 2));

      // Lire le template
      const templatePath = path.join(__dirname, '../../templates/contract.html');
      console.log('Template path:', templatePath);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template non trouvé: ${templatePath}`);
      }
      
      const templateHtml = fs.readFileSync(templatePath, 'utf8');
      console.log('Template lu, taille:', templateHtml.length);

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
      console.log('HTML généré, taille:', html.length);

      // Générer le PDF avec Puppeteer
      console.log('Lancement de Puppeteer...');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      page.setDefaultTimeout(30000);
      console.log('Page créée, chargement du contenu...');

      await page.setContent(html, { waitUntil: 'load' });
      console.log('Contenu chargé, attente du rendu...');
      
      // Attendre que le contenu soit bien rendu
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Génération du PDF...');
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

      console.log('PDF généré, taille:', pdfBuffer.length, 'bytes');
      await browser.close();

      return pdfBuffer;
    } catch (error) {
      console.error('Erreur génération contrat:', error);
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

    // Calculer le nombre de semaines entre startDate et endDate
    const start = new Date(subscription.startDate);
    const end = new Date(subscription.endDate);
    const diffTime = Math.abs(end - start);
    const numberOfWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

    // Prix fixes pour les paniers (selon le contrat de référence)
    const smallBasketPrice = 19;
    const largeBasketPrice = 29.80;

    // Calculs des prix totaux et paiements échelonnés
    const totalSmallPrice = (smallBasketPrice * numberOfWeeks).toFixed(2);
    const totalLargePrice = (largeBasketPrice * numberOfWeeks).toFixed(2);
    const halfSmallPrice = (totalSmallPrice / 2).toFixed(2);
    const halfLargePrice = (totalLargePrice / 2).toFixed(2);

    // Pour le paiement en 4 fois (Math.round → arrondi naturel, dernier chèque ajusté)
    const quarterSmall = Math.round(totalSmallPrice / 4);
    const quarterLarge = Math.round(totalLargePrice / 4);
    const lastQuarterSmall = (totalSmallPrice - (quarterSmall * 3)).toFixed(2);
    const lastQuarterLarge = (totalLargePrice - (quarterLarge * 3)).toFixed(2);
    
    const quarterPaymentSmallText = `3 chèques de ${quarterSmall}€<br>et 1 chèque de ${lastQuarterSmall}€`;
    const quarterPaymentLargeText = `3 chèques de ${quarterLarge}€<br>et 1 chèque de ${lastQuarterLarge}€`;

    // Nombre de permanences (exemple: 2 permanences par défaut, à adapter selon vos règles)
    const permanences = subscription.type === 'ANNUAL' ? '2 à 3' : '1';

    // Adresse de l'utilisateur
    const address = user.address || 'Non renseignée';

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
      totalSmallPrice: totalSmallPrice,
      totalLargePrice: totalLargePrice,
      halfSmallPrice: halfSmallPrice,
      halfLargePrice: halfLargePrice,
      quarterPaymentSmallText: quarterPaymentSmallText,
      quarterPaymentLargeText: quarterPaymentLargeText,

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

      // Date du jour
      contractDate: new Date().toLocaleDateString('fr-FR')
    };
  }
}

export default new ContractService();