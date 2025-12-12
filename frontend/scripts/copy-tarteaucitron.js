const fs = require('fs');
const path = require('path');

// Chemins source et destination
const sourceDir = path.join(__dirname, '../node_modules/tarteaucitronjs');
const destDir = path.join(__dirname, '../public/tarteaucitron');

// Créer le dossier de destination s'il n'existe pas
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copier récursivement tout le contenu du dossier tarteaucitronjs
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('📦 Copie de tous les fichiers tarteaucitron...');

try {
  copyRecursiveSync(sourceDir, destDir);
  console.log('✅ Tous les fichiers ont été copiés avec succès !');
} catch (error) {
  console.error('❌ Erreur lors de la copie:', error.message);
}

console.log('✨ Copie terminée !');
