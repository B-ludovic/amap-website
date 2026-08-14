import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

// Fonction pour se connecter à la base de données
const connectDB = async () => {
  try {
    // On essaie de se connecter
    await prisma.$connect();
    console.log('✅ Connecté à la base de données PostgreSQL');
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    process.exit(1);
  }
};

// Fonction pour se déconnecter proprement (utile quand on arrête le serveur)
const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Déconnecté de la base de données');
  } catch (error) {
    console.error('❌ Erreur lors de la déconnexion:', error.message);
  }
};


export { prisma, connectDB, disconnectDB };