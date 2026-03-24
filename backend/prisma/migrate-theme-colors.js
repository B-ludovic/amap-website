/**
 * Script de migration des couleurs de thème vers des valeurs accessibles (WCAG AA).
 * Met à jour uniquement les entrées ThemeConfig existantes en base de données.
 * Usage : node scripts/migrate-theme-colors.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACCESSIBLE_COLORS = {
  SPRING: {
    primaryColor: '#4a7a3a',
    secondaryColor: '#d4a574',
    accentColor: '#b04535',
    backgroundColor: '#f9f7f4',
  },
  SUMMER: {
    primaryColor: '#c47d0a',
    secondaryColor: '#fcd34d',
    accentColor: '#a85508',
    backgroundColor: '#fffbeb',
  },
  AUTUMN: {
    primaryColor: '#c2410c',
    secondaryColor: '#d97706',
    accentColor: '#b91c1c',
    backgroundColor: '#fff7ed',
  },
  WINTER: {
    primaryColor: '#0e7490',
    secondaryColor: '#06b6d4',
    accentColor: '#1d4ed8',
    backgroundColor: '#f0f9ff',
  },
};

async function main() {
  console.log('--- Migration des couleurs de thème (WCAG AA) ---\n');

  const themes = await prisma.themeConfig.findMany();

  if (themes.length === 0) {
    console.log('Aucun thème en base de données, rien à migrer.');
    return;
  }

  for (const theme of themes) {
    const newColors = ACCESSIBLE_COLORS[theme.season];
    if (!newColors) {
      console.log(`Saison inconnue "${theme.season}", ignorée.`);
      continue;
    }

    await prisma.themeConfig.update({
      where: { id: theme.id },
      data: newColors,
    });

    console.log(`✓ ${theme.season} mis à jour`);
    console.log(`  primary:    ${theme.primaryColor} → ${newColors.primaryColor}`);
    console.log(`  accent:     ${theme.accentColor} → ${newColors.accentColor}`);
  }

  console.log('\nMigration terminée.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
