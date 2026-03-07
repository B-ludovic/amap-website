import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed safe (sans suppression)...');

  // === POINT DE RETRAIT ===
  const pickupExists = await prisma.pickupLocation.findFirst({
    where: { isActive: true }
  });

  if (!pickupExists) {
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
  } else {
    console.log('⏭️  Point de retrait déjà existant, ignoré');
  }

  // === THÈMES SAISONNIERS ===
  const themesCount = await prisma.themeConfig.count();

  if (themesCount === 0) {
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
  } else {
    console.log('⏭️  Thèmes déjà existants, ignorés');
  }

  console.log('');
  console.log('🎉 Seed safe terminé !');
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
