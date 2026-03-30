'use client';

import { useState } from 'react';
import { Gift, Shield, Loader2, UserCheck, AlertCircle, Play } from 'lucide-react';
import { clsx } from "clsx";
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';

export function BonusTab() {
    const { welcomeBonusDeposit, loading } = useVault();
    const [address, setAddress] = useState('');
    const [status, setStatus] = useState<any>(null);

    const handleDistribute = async () => {
        if (!welcomeBonusDeposit || !address) return;
        try {
            await welcomeBonusDeposit(address);
            setStatus({ type: 'success', message: 'Bonus distributed successfully' });
            toast.success('Welcome bonus sent!');
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message });
            toast.error('Distribution failed: ' + err.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto pt-8">
            <div className="rounded-3xl border border-border bg-card p-8 space-y-8 shadow-xl relative">
                <div className="flex items-center gap-4 mb-2">
                    <div className="bg-primary/10 p-4 rounded-2xl">
                        <Gift className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Welcome Bonus Distribution</h3>
                        <p className="text-sm text-muted-foreground">Incentivize new users with a one-time yield boost.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">Recipient Wallet Address</label>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Paste Solana wallet address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-secondary/50 border border-border/50 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none transition-all font-mono"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                                <UserCheck className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {status && (
                    <div className={clsx(
                        "rounded-2xl p-5 text-sm font-medium border animate-in slide-in-from-left-2 duration-300",
                        status.type === 'success' ? "bg-green-500/5 border-green-500/10 text-green-500" : "bg-red-500/5 border-red-500/10 text-red-500"
                    )}>
                        <p className="flex items-start gap-3">
                            {status.type === 'success' ? <Gift className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                            <span>{status.message}</span>
                        </p>
                    </div>
                )}

                <div className="bg-secondary/30 rounded-2xl p-6 border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">Reward Amount</span>
                        <span className="text-lg font-black text-primary">5.00 USDC</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/60 leading-relaxed">
                        This action will mint 5 USDC (vault shares) and transfer it to the target user. The cost is split between the performance fee pool and company treasury as per the global configuration.
                    </div>
                </div>

                <button
                    onClick={handleDistribute}
                    disabled={loading || !address}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-[0.2em] hover:opacity-95 transition-all disabled:opacity-50 shadow-[0_10px_40px_rgba(var(--primary-rgb),0.2)] active:scale-95 flex items-center justify-center gap-3"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Confirm Distribution
                </button>
            </div>
        </div>
    );
}
