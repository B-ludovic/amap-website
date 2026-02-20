import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractLogo() {
  try {
    // Lire la capture d'écran
    const inputPath = process.argv[2] || path.join(__dirname, '../logo-screenshot.png');
    const outputPath = path.join(__dirname, '../assets/images/logo.png');

    // Créer le dossier si nécessaire
    const assetsDir = path.join(__dirname, '../assets/images');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Extraire et redimensionner le logo
    await sharp(inputPath)
      .extract({ 
        left: 0,    // Ajuste selon ta capture
        top: 0,     // Ajuste selon ta capture
        width: 300, // Ajuste selon ta capture
        height: 300 // Ajuste selon ta capture
      })
      .resize(200, 200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Fond transparent
      })
      .png()
      .toFile(outputPath);

    console.log('✅ Logo extrait avec succès:', outputPath);
  } catch (error) {
    console.error('❌ Erreur extraction logo:', error);
  }
}

extractLogo();