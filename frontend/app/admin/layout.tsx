'use client';

import { AdminGuard } from '@/components/AdminGuard';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminGuard>
            <div className="flex min-h-screen flex-col">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    {children}
                </div>
            </div>
        </AdminGuard>
    );
}
