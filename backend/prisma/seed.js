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

  // === UTILISATEURS ===
  console.log('👤 Création des utilisateurs...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
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

  const volunteer = await prisma.user.create({
    data: {
      email: 'benevole@auxptitspois.fr',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'Bénévole',
      phone: '0612345678',
      role: 'VOLUNTEER',
      emailVerified: true
    }
  });

  const member1 = await prisma.user.create({
    data: {
      email: 'marie.dupont@example.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '0623456789',
      role: 'MEMBER',
      emailVerified: true
    }
  });

  const member2 = await prisma.user.create({
    data: {
      email: 'jean.martin@example.com',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '0634567890',
      role: 'MEMBER',
      emailVerified: true
    }
  });

  console.log('✅ Utilisateurs créés');

  // === PRODUCTEURS ===
  console.log('🚜 Création des producteurs...');

  const producer1 = await prisma.producer.create({
    data: {
      name: 'Ferme des Lilas',
      description: 'Producteur de légumes bio depuis 1985. Nous cultivons plus de 30 variétés de légumes de saison en agriculture biologique.',
      email: 'contact@fermedeslilas.fr',
      phone: '0145678901',
      specialty: 'Légumes de saison',
      isActive: true,
      isExample: true
    }
  });

  const producer2 = await prisma.producer.create({
    data: {
      name: 'Les Vergers du Soleil',
      description: 'Fruits et légumes cultivés en agroécologie dans le respect de la nature.',
      email: 'contact@vergersdulsoleil.fr',
      phone: '0156789012',
      specialty: 'Fruits et légumes',
      isActive: true,
      isExample: true
    }
  });

  const producer3 = await prisma.producer.create({
    data: {
      name: 'La Ferme du Bonheur',
      description: 'Producteur local de fromages de chèvre et produits laitiers fermiers.',
      email: 'contact@fermedubonheur.fr',
      phone: '0167890123',
      specialty: 'Produits laitiers',
      isActive: true,
      isExample: true
    }
  });

  console.log('✅ Producteurs créés');

  // === PRODUITS ===
  console.log('🥕 Création des produits...');

  const carotte = await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Carottes',
      description: 'Carottes bio croquantes et sucrées',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  const tomate = await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Tomates',
      description: 'Tomates anciennes variées',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  const salade = await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Salade',
      description: 'Mélange de salades de saison',
      unit: 'PIECE',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  const pomme = await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Pommes',
      description: 'Pommes bio variétés anciennes',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  const poire = await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Poires',
      description: 'Poires Williams bio',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  const oeuf = await prisma.product.create({
    data: {
      producerId: producer3.id,
      name: 'Œufs',
      description: 'Œufs frais de poules élevées en plein air',
      unit: 'PIECE',
      category: 'EGGS',
      isActive: true
    }
  });

  // Légumes supplémentaires
  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Courgettes',
      description: 'Courgettes vertes et jaunes',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Aubergines',
      description: 'Aubergines violettes bio',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Poivrons',
      description: 'Poivrons rouges, verts et jaunes',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Concombres',
      description: 'Concombres croquants',
      unit: 'PIECE',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Radis',
      description: 'Radis roses de 18 jours',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Épinards',
      description: 'Jeunes pousses d\'épinards',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Brocoli',
      description: 'Brocoli frais',
      unit: 'PIECE',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Chou-fleur',
      description: 'Chou-fleur blanc',
      unit: 'PIECE',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Haricots verts',
      description: 'Haricots verts fins',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Betteraves',
      description: 'Betteraves rouges',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Courge butternut',
      description: 'Courge butternut douce',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Potiron',
      description: 'Potiron de saison',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Poireaux',
      description: 'Poireaux frais',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Navets',
      description: 'Navets nouveaux',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Pommes de terre',
      description: 'Pommes de terre variété Charlotte',
      unit: 'KG',
      category: 'VEGETABLES',
      isActive: true
    }
  });

  // Fruits supplémentaires
  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Fraises',
      description: 'Fraises gariguettes',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Framboises',
      description: 'Framboises fraîches',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Myrtilles',
      description: 'Myrtilles bio',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Cerises',
      description: 'Cerises burlat',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Abricots',
      description: 'Abricots de pays',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Pêches',
      description: 'Pêches jaunes',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Prunes',
      description: 'Prunes reines-claudes',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Raisin',
      description: 'Raisin blanc et noir',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Melons',
      description: 'Melons charentais',
      unit: 'PIECE',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Pastèques',
      description: 'Pastèques sucrées',
      unit: 'PIECE',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Kiwis',
      description: 'Kiwis de France',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Oranges',
      description: 'Oranges bio',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Citrons',
      description: 'Citrons de Menton',
      unit: 'KG',
      category: 'FRUITS',
      isActive: true
    }
  });

  console.log('✅ Produits créés');

  // === POINTS DE RETRAIT ===
  console.log('📍 Création du point de retrait...');

  const pickupLocation = await prisma.pickupLocation.create({
    data: {
      name: 'Salle des Fêtes',
      address: '12 Place du Marché',
      city: 'Paris',
      postalCode: '75001',
      schedule: 'Mercredi 18h15 - 19h15',
      instructions: 'Accès par la porte principale, côté parking',
      isActive: true
    }
  });

  console.log('✅ Point de retrait créé');

  // === PERMANENCES ===
  console.log('👥 Création des permanences...');

  const today = new Date();
  const nextWednesday = new Date(today);
  nextWednesday.setDate(today.getDate() + ((3 - today.getDay() + 7) % 7 || 7));

  const shift1 = await prisma.shift.create({
    data: {
      distributionDate: nextWednesday,
      startTime: '18:15',
      endTime: '19:15',
      volunteersNeeded: 2,
      notes: 'Préparation et distribution du panier hebdomadaire'
    }
  });

  const nextWednesday2 = new Date(nextWednesday);
  nextWednesday2.setDate(nextWednesday.getDate() + 7);

  const shift2 = await prisma.shift.create({
    data: {
      distributionDate: nextWednesday2,
      startTime: '18:15',
      endTime: '19:15',
      volunteersNeeded: 2
    }
  });

  // Inscription du bénévole
  await prisma.shiftVolunteer.create({
    data: {
      shiftId: shift1.id,
      userId: volunteer.id,
      role: 'Distribution',
      status: 'CONFIRMED'
    }
  });

  console.log('✅ Permanences créées');

  // === RECETTES ===
  console.log('📖 Création des recettes...');

  await prisma.recipe.create({
    data: {
      title: 'Tarte aux pommes maison',
      slug: 'tarte-aux-pommes-maison',
      description: 'Une délicieuse tarte aux pommes traditionnelle',
      ingredients: JSON.stringify([
        '4-5 pommes',
        '1 pâte brisée',
        '2 cuillères à soupe de sucre',
        '1 cuillère à café de cannelle'
      ]),
      steps: `1. Préchauffer le four à 180°C
2. Éplucher et couper les pommes en lamelles
3. Disposer les pommes sur la pâte
4. Saupoudrer de sucre et cannelle
5. Enfourner 30-35 minutes`,
      prepTime: 20,
      cookTime: 35,
      servings: 6,
      difficulty: 'EASY',
      season: 'AUTUMN',
      authorId: admin.id,
      isPublished: true,
      publishedAt: new Date(),
      products: {
        create: [
          {
            productId: pomme.id,
            quantity: '4-5 pièces',
            isOptional: false
          }
        ]
      }
    }
  });

  console.log('✅ Recettes créées');

  // === THÈMES SAISONNIERS ===
  console.log('🎨 Création des thèmes...');

  await prisma.themeConfig.createMany({
    data: [
      {
        season: 'SPRING',
        primaryColor: '#a7f3d0',
        secondaryColor: '#fcd34d',
        accentColor: '#fb923c',
        backgroundColor: '#fef3f9',
        isActive: true // Printemps par défaut
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
        primaryColor: '#fdba74',
        secondaryColor: '#fb923c',
        accentColor: '#dc2626',
        backgroundColor: '#fff7ed',
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
  console.log('📧 Comptes créés :');
  console.log('   Admin : admin@auxptitspois.fr / password123');
  console.log('   Bénévole : benevole@auxptitspois.fr / password123');
  console.log('   Membre 1 : marie.dupont@example.com / password123');
  console.log('   Membre 2 : jean.martin@example.com / password123');
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