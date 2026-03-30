'use client';

import React from 'react';
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdminPage = pathname?.startsWith('/admin');

    if (isAdminPage) {
        return <>{children}</>;
    }

    return (
        <>
            <Navbar />
            <main className="min-h-[calc(100vh-64px)] pb-16 md:pb-0">
                {children}
            </main>
            <Footer />
            <BottomNav />
        </>
    );
}
