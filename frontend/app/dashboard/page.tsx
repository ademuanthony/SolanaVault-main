'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { StatCard } from '@/components/StatCard';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { DollarSign, Layers, TrendingUp, PieChart, ArrowUpRight, ArrowDownLeft, Shield, RefreshCw, Sparkles, TrendingDown, Target, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useVault } from '@/hooks/useVault';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function Dashboard() {
    const { connection } = useConnection();
    const { connected, vaultState, globalConfig, userAccount, loading, refresh, isInitialized } = useVault();
    const [isDepositOpen, setIsDepositOpen] = useState(false);
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !connected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 text-center px-4 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative bg-card p-12 rounded-[3rem] border border-border shadow-2xl">
                        <Shield className="h-16 w-16 text-primary mx-auto mb-8" />
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4">Awaiting Connection</h1>
                        <p className="text-muted-foreground max-w-sm mb-10 text-sm font-medium leading-relaxed uppercase tracking-widest opacity-60">
                            Establish a secure link with your Solana wallet to access the yield engine.
                        </p>
                        <div className="flex justify-center scale-110">
                            {mounted && <WalletMultiButton />}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
                <div className="relative bg-amber-500/10 p-8 rounded-[3rem] border border-amber-500/20 max-w-lg">
                    <Shield className="w-16 h-16 text-amber-500 mx-auto mb-8 animate-pulse" />
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4 text-amber-500">Protocol Offline</h1>
                    <p className="text-muted-foreground mb-10 text-sm font-medium leading-relaxed uppercase tracking-widest opacity-60">
                        The Caifu protocol is not active on this cluster ({connection.rpcEndpoint}).
                        The administrator must initialize the genesis state.
                    </p>
                    <button
                        onClick={() => refresh()}
                        className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all font-black uppercase tracking-widest text-xs"
                    >
                        <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                        Retry Sync
                    </button>
                </div>
            </div>
        );
    }

    // Calculations
    const tvlRaw = Number(vaultState?.totalTvl || 0);
    const tvl = (tvlRaw / 1e6);
    const totalShares = vaultState ? Number(vaultState.totalShares) / 1e9 : 0;
    const userSharesRaw = userAccount ? Number(userAccount.shares) : 0;
    const userShares = userSharesRaw / 1e9;
    const userDeposit = userAccount ? (userSharesRaw * Number(userAccount.entryPrice) / 1e15) : 0;

    const sharePrice = totalShares > 0 ? (tvlRaw * 1e3) / Number(vaultState.totalShares) : 1;
    const currentValue = userShares * sharePrice;
    const profit = currentValue - userDeposit;
    const hasProfit = profit >= 0;

    // Dynamic Logic from GlobalConfig
    const t1Threshold = globalConfig?.tier1Threshold ? Number(globalConfig.tier1Threshold) / 1e6 : 100;
    const t2Threshold = globalConfig?.tier2Threshold ? Number(globalConfig.tier2Threshold) / 1e6 : 500;

    let currentFee = globalConfig?.tier1Fee || 70;
    let tierName = 'Standard';
    if (currentValue >= t2Threshold) {
        currentFee = globalConfig?.tier3Fee || 50;
        tierName = 'Elite';
    } else if (currentValue >= t1Threshold) {
        currentFee = globalConfig?.tier2Fee || 60;
        tierName = 'Pro';
    }

    return (
        <div className="container mx-auto px-4 py-12 space-y-12 max-w-7xl animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/50 pb-8">
                <div className="space-y-2">
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase flex items-center gap-4">
                        Dashboard
                        <span className="text-primary text-sm not-italic mt-4 font-black tracking-widest opacity-40">v2.1</span>
                    </h1>
                    <p className="text-muted-foreground uppercase font-black text-[10px] tracking-[0.3em] pl-1">Meteora DLMM Liquidity Engine</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => setIsDepositOpen(true)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-[0_12px_48px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all"
                    >
                        <ArrowUpRight className="mr-2 h-5 w-5" />
                        Deposit Funds
                    </button>
                    <button
                        onClick={() => setIsWithdrawOpen(true)}
                        className="flex-1 md:flex-none inline-flex items-center justify-center rounded-2xl bg-secondary px-8 py-4 text-xs font-black uppercase tracking-widest text-foreground hover:bg-secondary/80 active:scale-95 transition-all"
                    >
                        <ArrowDownLeft className="mr-2 h-5 w-5" />
                        Exit Position
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard label="My Allocation" value={`$${userDeposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={DollarSign} description="Net principal deployed" />
                <StatCard label="Vault Equity" value={`${userShares.toLocaleString(undefined, { maximumFractionDigits: 4 })}`} icon={Layers} description="Meteora LP Shares" />
                <StatCard
                    label="Current Market Value"
                    value={`$${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    icon={TrendingUp}
                    trend={`${hasProfit ? '+' : ''}$${Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    description="Redeemable value"
                />
                <StatCard label="Total Protocol TVL" value={`$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={PieChart} description="Shared vault liquidity" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black italic tracking-tighter uppercase">Yield Performance</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Live Analytics</span>
                        </div>
                    </div>
                    <div className="relative rounded-[3rem] border border-border/50 bg-card/60 backdrop-blur-xl p-12 h-[420px] flex flex-col items-center justify-center text-center overflow-hidden group shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <TrendingUp className="w-20 h-20 text-muted-foreground/10 mb-8" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] relative z-10">Historical Charting Implementation</p>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-4 max-w-xs leading-relaxed relative z-10">Enhanced visualization of share price growth coming in subsequent protocol update.</p>

                        {/* Subtle decoration */}
                        <div className="absolute -bottom-12 -left-12 opacity-[0.03] scale-150 rotate-12">
                            <Sparkles className="w-64 h-64" />
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">Status Report</h2>
                    <div className="rounded-[3rem] border border-border/50 bg-card/60 backdrop-blur-xl p-10 space-y-10 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                            <Target className="w-48 h-48" />
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Current Fee Ceiling</p>
                            <div className="flex items-center gap-4">
                                <div className="p-4 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                                    <span className="text-3xl font-black italic leading-none">{currentFee}%</span>
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-widest text-foreground">{tierName} Status</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest mt-1">Perf. Fee on Profits Only</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-end border-b border-border/50 pb-4">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Genesis Base</p>
                                    <p className="text-lg font-black italic tabular-nums">${userAccount && Number(userAccount.shares) > 0 ? (Number(userAccount.entryPrice) / 1e6).toFixed(4) : '1.0000'}</p>
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Entry Price</span>
                            </div>

                            <div className="flex justify-between items-end border-b border-border/50 pb-4">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Market Pulse</p>
                                    <p className="text-lg font-black italic tabular-nums text-primary">${sharePrice.toFixed(4)}</p>
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Share Price</span>
                            </div>
                        </div>

                        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Optimization Active</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">Your assets are being managed by Meteora DLMM Dynamic Vault architecture. Zero management fees.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">Transaction Record</h2>
                </div>
                <TransactionHistory />
            </div>

            <DepositModal isOpen={isDepositOpen} onClose={() => { setIsDepositOpen(false); refresh(); }} />
            <WithdrawModal isOpen={isWithdrawOpen} onClose={() => { setIsWithdrawOpen(false); refresh(); }} />
        </div>
    );
}
