import puppeteer from 'puppeteer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContractService {
  // Générer le contrat PDF pour un abonnement //
  
  async generateContract(subscription, user) {
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

      // Préparer les données
      const data = this.prepareContractData(subscription, user);
      console.log('Données préparées:', JSON.stringify(data, null, 2));

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

      // Test : sauvegarder le PDF pour vérification
      const testPath = path.join(__dirname, '../../test-contract.pdf');
      fs.writeFileSync(testPath, pdfBuffer);
      console.log('PDF de test sauvegardé:', testPath);

      return pdfBuffer;
    } catch (error) {
      console.error('Erreur génération contrat:', error);
      throw error;
    }
  }

  // Préparer les données pour le template //

  prepareContractData(subscription, user) {
    const subscriptionTypeLabel = subscription.type === 'ANNUAL' 
      ? 'Abonnement Annuel' 
      : 'Abonnement Découverte (3 mois)';

    const basketSizeLabel = subscription.basketSize === 'SMALL'
      ? 'Petit panier (2-4 kg)'
      : 'Grand panier (6-8 kg)';

    const pricingTypeLabel = subscription.pricingType === 'SOLIDARITY'
      ? 'Tarif solidaire (20%)'
      : 'Tarif normal (100%)';

    return {
      // Informations utilisateur
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || 'Non renseigné',

      // Informations abonnement
      subscriptionNumber: subscription.subscriptionNumber,
      subscriptionTypeLabel,
      basketSizeLabel,
      pricingTypeLabel,
      price: subscription.price.toFixed(2),
      startDate: new Date(subscription.startDate).toLocaleDateString('fr-FR'),
      endDate: new Date(subscription.endDate).toLocaleDateString('fr-FR'),

      // Point de retrait
      pickupLocationName: subscription.pickupLocation.name,
      pickupLocationAddress: subscription.pickupLocation.address + ', ' + 
        subscription.pickupLocation.postalCode + ' ' + subscription.pickupLocation.city,
      pickupSchedule: subscription.pickupLocation.schedule,

      // Conditions booléennes pour Handlebars
      isAnnual: subscription.type === 'ANNUAL',
      isSmallBasket: subscription.basketSize === 'SMALL',
      isSolidarity: subscription.pricingType === 'SOLIDARITY',

      // Date du jour
      contractDate: new Date().toLocaleDateString('fr-FR')
    };
  }
}

export default new ContractService();