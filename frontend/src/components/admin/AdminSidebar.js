'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Tractor, 
  Package, 
  ShoppingBasket, 
  Calendar,
  ShoppingCart,
  Users,
  MapPin,
  FileText,
  Palette,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';

export default function AdminSidebar({ currentPath }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { showConfirm } = useModal();
  const [openMenus, setOpenMenus] = useState({});

  const handleLogout = () => {
    showConfirm(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      () => {
        logout();
        router.push('/');
      }
    );
  };

  const toggleMenu = (menuKey) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      path: '/admin',
      exact: true
    },
    {
      title: 'Producteurs',
      icon: Tractor,
      path: '/admin/producteurs'
    },
    {
      title: 'Produits',
      icon: Package,
      path: '/admin/produits'
    },
    {
      title: 'Paniers',
      icon: ShoppingBasket,
      path: '/admin/paniers'
    },
    {
      title: 'Disponibilités',
      icon: Calendar,
      path: '/admin/disponibilites'
    },
    {
      title: 'Commandes',
      icon: ShoppingCart,
      path: '/admin/commandes'
    },
    {
      title: 'Utilisateurs',
      icon: Users,
      path: '/admin/utilisateurs'
    },
    {
      title: 'Points de retrait',
      icon: MapPin,
      path: '/admin/points-retrait'
    },
    {
      title: 'Blog',
      icon: FileText,
      path: '/admin/blog'
    },
    {
      title: 'Thème',
      icon: Palette,
      path: '/admin/theme'
    },
    {
      title: 'Paramètres',
      icon: Settings,
      path: '/admin/parametres'
    }
  ];

  const isActive = (item) => {
    if (item.exact) {
      return currentPath === item.path;
    }
    return currentPath.startsWith(item.path);
  };

  return (
    <aside className="admin-sidebar">
      {/* Logo */}
      <div className="admin-sidebar-header">
        <Link href="/admin" className="admin-logo">
          <span className="admin-logo-icon">
            <Image 
              src="/icons/pea.png" 
              alt="Logo" 
              width={32} 
              height={32}
            />
          </span>
          <span className="admin-logo-text">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          if (item.subItems) {
            const isOpen = openMenus[item.title];
            return (
              <div key={item.title} className="admin-nav-group">
                <button
                  onClick={() => toggleMenu(item.title)}
                  className={`admin-nav-item ${active ? 'admin-nav-item-active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{item.title}</span>
                  <ChevronDown 
                    size={16} 
                    className={`admin-nav-chevron ${isOpen ? 'admin-nav-chevron-open' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="admin-nav-submenu">
                    {item.subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const subActive = currentPath === subItem.path;
                      return (
                        <Link
                          key={subItem.path}
                          href={subItem.path}
                          className={`admin-nav-subitem ${subActive ? 'admin-nav-subitem-active' : ''}`}
                        >
                          <SubIcon size={18} />
                          <span>{subItem.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`admin-nav-item ${active ? 'admin-nav-item-active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-nav-item">
          <span>← Retour au site</span>
        </Link>
        <button onClick={handleLogout} className="admin-nav-item">
          <LogOut size={20} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}