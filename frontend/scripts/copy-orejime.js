import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '../node_modules/orejime/dist');
const dest = join(__dirname, '../public/orejime');

mkdirSync(dest, { recursive: true });
copyFileSync(join(src, 'orejime-standard-fr.js'), join(dest, 'orejime-standard-fr.js'));
copyFileSync(join(src, 'orejime-standard.css'), join(dest, 'orejime-standard.css'));

console.log('✓ Orejime copié dans public/orejime/');
