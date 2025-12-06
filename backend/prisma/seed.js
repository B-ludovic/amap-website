import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed...');

  // Nettoyer la base de données (attention en production !)
  console.log('🧹 Nettoyage de la base...');
  await prisma.notificationEmail.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.themeConfig.deleteMany();
  await prisma.cartReservation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.basketAvailability.deleteMany();
  await prisma.basketTypeProduct.deleteMany();
  await prisma.basketType.deleteMany();
  await prisma.product.deleteMany();
  await prisma.producer.deleteMany();
  await prisma.pickupLocation.deleteMany();
  await prisma.address.deleteMany();
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

  const customer1 = await prisma.user.create({
    data: {
      email: 'marie.dupont@example.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '0612345678',
      role: 'CUSTOMER',
      emailVerified: true,
      addresses: {
        create: [
          {
            street: '12 rue des Fleurs',
            city: 'Paris',
            postalCode: '75001',
            country: 'France',
            isDefault: true,
            type: 'BILLING'
          }
        ]
      }
    }
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'jean.martin@example.com',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '0698765432',
      role: 'CUSTOMER',
      emailVerified: true,
      addresses: {
        create: [
          {
            street: '45 avenue des Champs',
            city: 'Lyon',
            postalCode: '69001',
            country: 'France',
            isDefault: true,
            type: 'BILLING'
          }
        ]
      }
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
      unit: 'kg',
      origin: 'Île-de-France',
      isExample: true
    }
  });

  const tomate = await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Tomates',
      description: 'Tomates anciennes variées',
      unit: 'kg',
      origin: 'Île-de-France',
      isExample: true
    }
  });

  const salade = await prisma.product.create({
    data: {
      producerId: producer1.id,
      name: 'Salade',
      description: 'Mélange de salades de saison',
      unit: 'pièce',
      origin: 'Île-de-France',
      isExample: true
    }
  });

  const pomme = await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Pommes',
      description: 'Pommes bio variétés anciennes',
      unit: 'kg',
      origin: 'Normandie'
    }
  });

  const poire = await prisma.product.create({
    data: {
      producerId: producer2.id,
      name: 'Poires',
      description: 'Poires Williams bio',
      unit: 'kg',
      origin: 'Normandie',
      isExample: true
    }
  });

  const fromage = await prisma.product.create({
    data: {
      producerId: producer3.id,
      name: 'Fromage de chèvre',
      description: 'Fromage de chèvre frais fermier',
      unit: 'pièce',
      origin: 'Auvergne',
      isExample: true
    }
  });

  const yaourt = await prisma.product.create({
    data: {
      producerId: producer3.id,
      name: 'Yaourt nature',
      description: 'Yaourt au lait de chèvre',
      unit: 'lot de 4',
      origin: 'Auvergne',
      isExample: true
    }
  });

  console.log('✅ Produits créés');

  // === TYPES DE PANIERS ===
  console.log('🧺 Création des types de paniers...');

  const panierDecouverte = await prisma.basketType.create({
    data: {
      name: 'Panier Découverte',
      description: 'Un panier varié pour découvrir nos produits locaux. Idéal pour 2 personnes.',
      price: 25.00,
      isActive: true,
      products: {
        create: [
          { productId: carotte.id, quantity: 1.5 },
          { productId: tomate.id, quantity: 1.0 },
          { productId: salade.id, quantity: 2.0 },
          { productId: pomme.id, quantity: 1.0 }
        ]
      }
    }
  });

  const panierFamille = await prisma.basketType.create({
    data: {
      name: 'Panier Famille',
      description: 'Un grand panier pour toute la famille. Pour 4 à 5 personnes.',
      price: 45.00,
      isActive: true,
      isExample: true,
      products: {
        create: [
          { productId: carotte.id, quantity: 2.5 },
          { productId: tomate.id, quantity: 2.0 },
          { productId: salade.id, quantity: 3.0 },
          { productId: pomme.id, quantity: 2.0 },
          { productId: poire.id, quantity: 1.5 },
          { productId: fromage.id, quantity: 1.0 }
        ]
      }
    }
  });

  const panierFruits = await prisma.basketType.create({
    data: {
      name: 'Panier Fruits',
      description: 'Un panier 100% fruits de saison.',
      price: 18.00,
      isActive: true,
      isExample: true,
      products: {
        create: [
          { productId: pomme.id, quantity: 2.0 },
          { productId: poire.id, quantity: 2.0 }
        ]
      }
    }
  });

  console.log('✅ Types de paniers créés');

  // === POINTS DE RETRAIT ===
  console.log('📍 Création des points de retrait...');

  const pickup1 = await prisma.pickupLocation.create({
    data: {
      name: 'Place du Marché - Paris',
      address: '12 Place du Marché',
      city: 'Paris',
      postalCode: '75001',
      description: 'Retrait tous les mercredis de 17h à 19h',
      isActive: true,
      isExample: true
    }
  });

  const pickup2 = await prisma.pickupLocation.create({
    data: {
      name: 'Maison de Quartier - Lyon',
      address: '45 rue de la République',
      city: 'Lyon',
      postalCode: '69001',
      description: 'Retrait tous les vendredis de 16h à 18h',
      isActive: true,
      isExample: true
    }
  });

  console.log('✅ Points de retrait créés');

  // === DISPONIBILITÉS DES PANIERS ===
  console.log('📦 Création des disponibilités...');

  // Créer des disponibilités pour les 4 prochaines semaines
  const today = new Date();
  
  for (let i = 0; i < 4; i++) {
    const distributionDate = new Date(today);
    distributionDate.setDate(today.getDate() + (i * 7)); // +7 jours à chaque itération

    // Panier Découverte - Paris
    await prisma.basketAvailability.create({
      data: {
        basketTypeId: panierDecouverte.id,
        availableQuantity: 20,
        distributionDate,
        pickupLocationId: pickup1.id
      }
    });

    // Panier Famille - Paris
    await prisma.basketAvailability.create({
      data: {
        basketTypeId: panierFamille.id,
        availableQuantity: 15,
        distributionDate,
        pickupLocationId: pickup1.id
      }
    });

    // Panier Fruits - Paris
    await prisma.basketAvailability.create({
      data: {
        basketTypeId: panierFruits.id,
        availableQuantity: 25,
        distributionDate,
        pickupLocationId: pickup1.id
      }
    });

    // Panier Découverte - Lyon
    await prisma.basketAvailability.create({
      data: {
        basketTypeId: panierDecouverte.id,
        availableQuantity: 18,
        distributionDate,
        pickupLocationId: pickup2.id
      }
    });

    // Panier Famille - Lyon
    await prisma.basketAvailability.create({
      data: {
        basketTypeId: panierFamille.id,
        availableQuantity: 12,
        distributionDate,
        pickupLocationId: pickup2.id
      }
    });
  }

  console.log('✅ Disponibilités créées');

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

  // === ARTICLES DE BLOG ===
  console.log('📝 Création des articles de blog...');

  await prisma.blogPost.create({
    data: {
      title: 'Bienvenue sur Aux P\'tits Pois',
      slug: 'bienvenue-aux-ptits-pois',
      content: `
        Nous sommes ravis de vous accueillir sur notre nouvelle plateforme !
        
        Aux P'tits Pois est une AMAP qui vous permet de commander directement 
        vos paniers de produits locaux et bio auprès de nos producteurs partenaires.
        
        Chaque semaine, découvrez nos paniers composés de fruits et légumes de saison,
        produits laitiers et bien plus encore !
        
        Rejoignez notre communauté et soutenez l'agriculture locale.
      `,
      excerpt: 'Découvrez notre nouvelle plateforme de commande en ligne pour l\'AMAP Aux P\'tits Pois',
      authorId: admin.id,
      isPublished: true,
      publishedAt: new Date()
    }
  });

  await prisma.blogPost.create({
    data: {
      title: 'Les légumes de saison en décembre',
      slug: 'legumes-saison-decembre',
      content: `
        En décembre, c'est la saison des légumes d'hiver !
        
        Retrouvez dans nos paniers : carottes, poireaux, choux, courges, 
        panais, navets et bien d'autres légumes qui se conservent bien 
        et se prêtent à de délicieuses recettes réconfortantes.
        
        N'hésitez pas à nous demander des idées de recettes !
      `,
      excerpt: 'Découvrez quels légumes privilégier en hiver',
      authorId: admin.id,
      isPublished: true,
      publishedAt: new Date()
    }
  });

  console.log('✅ Articles de blog créés');

  console.log('');
  console.log('🎉 Seed terminé avec succès !');
  console.log('');
  console.log('📧 Comptes créés :');
  console.log('   Admin : admin@auxptitspois.fr / password123');
  console.log('   Client 1 : marie.dupont@example.com / password123');
  console.log('   Client 2 : jean.martin@example.com / password123');
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