'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AuthHeader from './AuthHeader';

/* Les pages d'authentification remplacent la navigation complète par un
   header réduit (logo + retour au site), conformément à la maquette.
   L'administration, elle, porte sa propre coquille en pleine fenêtre : barre
   latérale collante et bandeau de section. Le header public y ferait une
   deuxième barre au-dessus et décalerait les deux éléments collants. */
export default function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) {
    return null;
  }
  if (pathname.startsWith('/auth')) {
    return <AuthHeader variant={pathname === '/auth/register' ? 'signin' : 'back'} />;
  }
  return <Header />;
}
