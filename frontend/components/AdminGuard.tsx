'use client';

import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const { isAdmin } = useIsAdmin();
    const { connected, publicKey, connecting } = useWallet();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && connected && publicKey && !isAdmin) {
            toast.error("Access Denied. Admin only.");
            router.push('/');
        }
    }, [connected, publicKey, isAdmin, router, mounted]);

    if (!mounted) return null;

    if (!connected || connecting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 text-center px-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background animate-in fade-in duration-700">
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/30 transition-all duration-700" />
                    <div className="relative bg-card p-10 rounded-[3rem] border border-border shadow-2xl max-w-sm w-full mx-auto">
                        {connecting ? (
                            <Loader2 className="h-20 w-20 text-primary mx-auto mb-6 animate-spin" />
                        ) : (
                            <ShieldAlert className="h-20 w-20 text-primary mx-auto mb-6 animate-pulse" />
                        )}
                        <h2 className="text-3xl font-black mb-4 tracking-tighter italic uppercase text-foreground">Admin Entry</h2>
                        <p className="text-muted-foreground mb-10 text-sm font-medium uppercase tracking-[0.1em] leading-relaxed">
                            {connecting ? "Handshaking with Solana network..." : "Please connect your authorized admin wallet to proceed."}
                        </p>
                        <div className="flex justify-center scale-110">
                            <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-xl lg:!rounded-2xl !h-12 !px-8 !font-black !uppercase !tracking-widest !text-xs !border-none !shadow-xl hover:!opacity-90 active:!scale-95 transition-all" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground animate-pulse">Verifying Authority...</p>
            </div>
        );
    }

    return <>{children}</>;
}
