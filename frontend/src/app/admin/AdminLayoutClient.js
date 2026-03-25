'use client';

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import "../../styles/admin/layout.css";
import "../../styles/admin/components.css";

export default function AdminLayoutClient({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, user, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                router.push('/auth/login');
            } else if (user.role !== 'ADMIN') {
                router.push('/');
            }
        }
    }, [isAuthenticated, loading, user, router]);

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="container">
                    <p className="text-center">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'ADMIN') {
        return null;
    }

    return (
        <div className="admin-layout">
            <AdminSidebar currentPath={pathname} />
            <div className="admin-main">
                <AdminHeader />
                <div className="admin-content">
                    {children}
                </div>
            </div>
        </div>
    );
}
