'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarOff, Package, Tractor } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/public/producer-space.css';

const TABS = [
  { href: '/espace-producteur/ferme', label: 'Ma ferme', Icon: Tractor },
  { href: '/espace-producteur/produits', label: 'Mes produits', Icon: Package },
  { href: '/espace-producteur/absences', label: 'Mes absences', Icon: CalendarOff },
];

/* Rien ne s'affiche ni ne s'appelle tant que le compte n'est pas producteur :
   une requête de l'espace venue d'un autre rôle serait un refus journalisé. */
export default function ProducerSpaceShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (user.role !== 'PRODUCER') {
      router.replace('/acces-producteur');
    }
  }, [loading, isAuthenticated, user, pathname, router]);

  if (loading || user?.role !== 'PRODUCER') {
    return (
      <div className="pspace">
        <p className="container pspace-loading">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="pspace">
      <nav className="pspace-tabs" aria-label="Espace producteur">
        <div className="pspace-tabs-inner">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`pspace-tab${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="container pspace-main">{children}</main>
    </div>
  );
}
