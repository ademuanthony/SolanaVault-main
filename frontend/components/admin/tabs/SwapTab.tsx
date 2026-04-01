'use client';

import { useState } from 'react';
import { RefreshCw, Shield, Loader2, ArrowDown } from 'lucide-react';
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';

export function SwapTab() {
    const { jupiter_swap: jupiterSwap, loading } = useVault();
    const [fromAmount, setFromAmount] = useState('');
    const [fromToken, setFromToken] = useState('USDC');
    const [toToken, setToToken] = useState('SOL');

    // Mainnet Mints
    const TOKENS = {
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'SOL': 'So11111111111111111111111111111111111111112',
    };

    const handleSwap = async () => {
        if (!fromAmount || Number(fromAmount) <= 0) return;
        try {
            await jupiterSwap(
                TOKENS[fromToken as keyof typeof TOKENS],
                TOKENS[toToken as keyof typeof TOKENS],
                Number(fromAmount)
            );
            toast.success('Swap executed successfully!');
            setFromAmount('');
        } catch (e: any) {
            console.error(e);
            toast.error('Swap failed: ' + e.message);
        }
    };

    const switchTokens = () => {
        const temp = fromToken;
        setFromToken(toToken);
        setToToken(temp);
    };

    return (
        <div className="max-w-md mx-auto animate-in fade-in duration-300 pt-4 lg:pt-8 w-full">
            <div className="rounded-2xl lg:rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-5 lg:p-8 space-y-6 lg:space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

                <div className="space-y-1">
                    <h3 className="text-lg lg:text-xl font-bold tracking-tight">Admin Swap</h3>
                    <p className="text-[10px] lg:text-sm text-muted-foreground">Manage vault liquidity via Jupiter DEX.</p>
                </div>

                <div className="space-y-3 lg:space-y-4 relative">
                    <div className="bg-secondary/40 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-border/50 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40">
                        <div className="flex justify-between items-center mb-1.5 lg:mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <label>From</label>
                            <span className="opacity-50">Vault: --</span>
                        </div>
                        <div className="flex gap-3 lg:gap-4">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={fromAmount}
                                onChange={(e) => setFromAmount(e.target.value)}
                                className="flex-1 bg-transparent text-lg lg:text-xl font-semibold outline-none placeholder:text-muted-foreground/30 min-w-0"
                            />
                            <select
                                value={fromToken}
                                onChange={(e) => setFromToken(e.target.value)}
                                className="bg-background/80 rounded-lg lg:rounded-xl px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm font-bold border border-border/50 outline-none shrink-0"
                            >
                                {Object.keys(TOKENS).map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-center -my-5 lg:-my-6 relative z-10">
                        <button
                            onClick={switchTokens}
                            className="bg-card border-2 border-border p-2 lg:p-3 rounded-xl lg:rounded-2xl hover:bg-secondary transition-all shadow-lg active:scale-95 group"
                        >
                            <ArrowDown className="h-4 lg:h-5 w-4 lg:w-5 text-primary group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                    </div>

                    <div className="bg-secondary/40 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-border/50">
                        <div className="flex justify-between items-center mb-1.5 lg:mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <label>To</label>
                        </div>
                        <div className="flex gap-3 lg:gap-4">
                            <input
                                type="text"
                                disabled
                                placeholder="Live Quote"
                                className="flex-1 bg-transparent text-lg lg:text-xl font-semibold outline-none text-muted-foreground/30 min-w-0"
                            />
                            <select
                                value={toToken}
                                onChange={(e) => setToToken(e.target.value)}
                                className="bg-background/80 rounded-lg lg:rounded-xl px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm font-bold border border-border/50 outline-none shrink-0"
                            >
                                {Object.keys(TOKENS).map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 p-3 lg:p-4 rounded-xl lg:rounded-2xl text-[9px] lg:text-[11px] text-amber-500/80 flex gap-2 lg:gap-3 leading-relaxed">
                    <Shield className="w-4 h-4 lg:w-5 lg:h-5 shrink-0 mt-0.5 opacity-60" />
                    <span>Swap small amounts first to ensure the simulation succeeds on-chain.</span>
                </div>

                <button
                    onClick={handleSwap}
                    disabled={loading || !fromAmount}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-[0_8px_32px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden active:scale-95"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    {loading ? 'Processing...' : 'Execute Swap'}
                </button>
            </div>
        </div>
    );
}
