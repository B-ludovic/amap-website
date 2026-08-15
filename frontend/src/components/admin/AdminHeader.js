'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

/* Titres du fil d'Ariane. Les clés sont des préfixes : la correspondance
   retenue est la plus longue, pour qu'une fiche de détail hérite du titre de
   sa section parente. */
const VIEW_TITLES = {
  '/admin': 'Tableau de bord',
  '/admin/utilisateurs': 'Utilisateurs',
  '/admin/demandes-abonnements': 'Demandes d\'abonnements',
  '/admin/abonnements': 'Abonnements',
  '/admin/tresorerie': 'Trésorerie',
  '/admin/demandes-producteurs': 'Demandes producteurs',
  '/admin/producteurs': 'Producteurs',
  '/admin/produits': 'Produits',
  '/admin/panier-hebdomadaire': 'Panier hebdomadaire',
  '/admin/distribution': 'Distribution',
  '/admin/permanences': 'Permanences',
  '/admin/messages': 'Messages de contact',
  '/admin/communication': 'Communication',
  '/admin/fermetures': 'Fermetures AMAP',
  '/admin/journal': 'Journal d\'audit',
  '/admin/parametres': 'Paramètres'
};

function resolveTitle(pathname) {
  return Object.keys(VIEW_TITLES)
    .filter(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)
    .map(prefix => VIEW_TITLES[prefix])[0] ?? 'Administration';
}

export default function AdminHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(null);

  /* La pastille n'annonce que ce qui est vrai : l'API ne renvoie un panier que
     s'il est publié et que sa distribution est à venir. Sans panier, pas de
     pastille. */
  useEffect(() => {
    api.weeklyBaskets.getCurrent()
      .then(res => setCurrentWeek(res.data?.weekNumber ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="admin-header">
      <div className="admin-header-crumbs">
        <span className="admin-header-scope">Admin</span>
        <span className="admin-header-sep" aria-hidden="true">/</span>
        <span className="admin-header-title">{resolveTitle(pathname)}</span>
      </div>

      <div className="admin-header-aside">
        {currentWeek !== null && (
          <span className="admin-header-live">
            <span className="live-dot" aria-hidden="true"></span>
            <span>Semaine {currentWeek} publiée</span>
          </span>
        )}

        <span className="admin-header-user">
          {user?.firstName}
          <span className="admin-header-role">Admin</span>
        </span>
      </div>
    </header>
  );
}
