'use client';

import { useIsAdmin } from '@/hooks/useIsAdmin';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import clsx from 'clsx';
import { LayoutDashboard, Users, Shield, LineChart, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Navbar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const { isAdmin } = useIsAdmin();

    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Referrals', href: '/referral', icon: Users },
        { name: 'Leaderboard', href: '/leaderboard', icon: LineChart },
    ];

    return (
        <nav className="sticky top-0 z-[60] w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
            <div className="container mx-auto flex h-20 items-center justify-between px-6">
                <div className="flex items-center gap-12">
                    <Link href="/" className="group flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] group-hover:scale-110 transition-transform">
                            <Shield className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <span className="font-black italic text-2xl tracking-tighter uppercase">Caifu</span>
                    </Link>

                    <div className="hidden lg:flex items-center gap-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        "px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 group relative overflow-hidden",
                                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                                    <Icon className={clsx("h-4 w-4 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {mounted && isAdmin && (
                        <Link
                            href="/admin"
                            className="hidden md:flex items-center gap-2 px-4 py-2 border border-primary/20 bg-primary/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                        >
                            <Shield className="w-3.5 h-3.5" />
                            Admin Console
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    )}
                    <div className="flex items-center gap-4 scale-90 md:scale-100">
                        {mounted && <WalletMultiButton className="!bg-foreground !text-background !rounded-2xl !h-12 !font-black !uppercase !tracking-widest !text-[11px] !border-none !shadow-xl hover:!opacity-90 active:!scale-95 transition-all" />}
                    </div>
                </div>
            </div>
        </nav>
    );
}
