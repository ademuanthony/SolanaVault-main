'use client';

import { useIsAdmin } from '@/hooks/useIsAdmin';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { LayoutDashboard, Users, Shield, LineChart } from 'lucide-react';
import { useEffect, useState } from 'react';

export function BottomNav() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const { isAdmin } = useIsAdmin();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const navItems = [
        ...(isAdmin ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Referrals', href: '/referral', icon: Users },
        { name: 'Leaderboard', href: '/leaderboard', icon: LineChart },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur-lg pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-primary/70"
                            )}
                        >
                            <Icon className={clsx("h-5 w-5", isActive && "fill-current/20")} />
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
