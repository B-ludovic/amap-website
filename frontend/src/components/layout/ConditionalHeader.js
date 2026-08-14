'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AuthHeader from './AuthHeader';

/* Les pages d'authentification remplacent la navigation complète par un
   header réduit (logo + retour au site), conformément à la maquette. */
export default function ConditionalHeader() {
  const pathname = usePathname();
  if (pathname.startsWith('/auth')) {
    return <AuthHeader variant={pathname === '/auth/register' ? 'signin' : 'back'} />;
  }
  return <Header />;
}
