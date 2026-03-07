import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Nettoyer la base de données (attention en production !)
  console.log('🧹 Nettoyage de la base...');
  await prisma.recipeProduct.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.shiftVolunteer.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.newsletter.deleteMany();
  await prisma.producerInquiry.deleteMany();
  await prisma.weeklyPickup.deleteMany();
  await prisma.weeklyBasketItem.deleteMany();
  await prisma.weeklyBasket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscriptionPause.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionRequest.deleteMany();
  await prisma.themeConfig.deleteMany();
  await prisma.product.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.pickupLocation.deleteMany();
  await prisma.user.deleteMany();

  // === ADMIN ===
  console.log('👤 Création du compte admin...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      email: 'admin@auxptitspois.fr',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Aux P\'tits Pois',
      phone: '0601020304',
      role: 'ADMIN',
      emailVerified: true
    }
  });

  console.log('✅ Admin créé');

  // === POINT DE RETRAIT ===
  console.log('📍 Création du point de retrait...');

  await prisma.pickupLocation.create({
    data: {
      name: 'Paroisse Saint François de Sales',
      address: '340 Avenue du Général De Gaulle',
      city: 'Clamart',
      postalCode: '92140',
      schedule: 'Chaque mercredi entre 18h15 et 19h15',
      instructions: '',
      isActive: true
    }
  });

  console.log('✅ Point de retrait créé');

  // === THÈMES SAISONNIERS ===
  console.log('🎨 Création des thèmes...');

  await prisma.themeConfig.createMany({
    data: [
      {
        season: 'SPRING',
        primaryColor: '#6b9d5a',
        secondaryColor: '#d4a574',
        accentColor: '#fb923c',
        backgroundColor: '#fafaf8',
        isActive: true
      },
      {
        season: 'SUMMER',
        primaryColor: '#fef08a',
        secondaryColor: '#fde047',
        accentColor: '#fb923c',
        backgroundColor: '#fffbeb',
        isActive: false
      },
      {
        season: 'AUTUMN',
        primaryColor: '#f4a460',
        secondaryColor: '#daa520',
        accentColor: '#cd853f',
        backgroundColor: '#fffaf0',
        isActive: false
      },
      {
        season: 'WINTER',
        primaryColor: '#a5b4fc',
        secondaryColor: '#818cf8',
        accentColor: '#6366f1',
        backgroundColor: '#eef2ff',
        isActive: false
      }
    ]
  });

  console.log('✅ Thèmes créés');

  console.log('');
  console.log('🎉 Seed terminé avec succès !');
  console.log('');
  console.log('📧 Compte admin : admin@auxptitspois.fr / password123');
  console.log('');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur lors du seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
