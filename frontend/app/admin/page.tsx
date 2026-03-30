'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { RefreshCw, Shield, Building2, Users, Loader2, Layers, Gift, DollarSign, LayoutDashboard, Database, Repeat, MousePointer2, ChevronRight, Menu, X, PlusCircle, Settings, ShieldAlert, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';

// New Tab Components
import { OverviewTab } from '@/components/admin/tabs/OverviewTab';
import { PositionsTab } from '@/components/admin/tabs/PositionsTab';
import { SwapTab } from '@/components/admin/tabs/SwapTab';
import { BonusTab } from '@/components/admin/tabs/BonusTab';
import { FeesTab } from '@/components/admin/tabs/FeesTab';
import { ConfigTab } from '@/components/admin/tabs/ConfigTab';
import { UserManagementTab } from '@/components/admin/UserManagementTab';
import { InputField } from '@/components/admin/InputField';

export default function AdminDashboard() {
    const { connected, publicKey, vaultState, globalConfig, loading, refresh, isInitialized, initialize, program } = useVault();
    const [referralPoolTotal, setReferralPoolTotal] = useState(0);
    const [activeTab, setActiveTab] = useState('overview');
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [showAdvancedInit, setShowAdvancedInit] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        setMounted(true);
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    }, []);

    useEffect(() => {
        if (!program || !isInitialized) return;
        let active = true;
        const fetchTotals = async () => {
            try {
                const all = await program.account.userAccount.all();
                const sumRaw = all.reduce((acc: number, r: any) => acc + Number(r.account.unclaimedReferralEarnings || 0), 0);
                if (active) {
                    setReferralPoolTotal(sumRaw / 1e6);
                    setTotalUsersCount(all.length);
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };
        fetchTotals();
        return () => { active = false; };
    }, [program, isInitialized]);

    if (!mounted) {
        return null;
    }

    if (!isInitialized) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-card border border-border/50 rounded-[3rem] overflow-hidden shadow-[0_32px_120px_rgba(0,0,0,0.5)]">
                    {/* Left: Branding */}
                    <div className="p-12 bg-gradient-to-br from-primary via-primary/80 to-primary/40 text-black flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 scale-150">
                            <Shield className="w-64 h-64" />
                        </div>
                        <div className="relative z-10">
                            <Shield className="w-16 h-16 mb-8" />
                            <h2 className="text-5xl font-black italic tracking-tighter leading-none mb-6">VAULT<br />INITIALIZATION</h2>
                            <p className="text-black/70 font-bold uppercase tracking-[0.2em] text-[10px]">On-Chain Genesis Protocol</p>
                        </div>
                        <div className="relative z-10 space-y-4">
                            <p className="text-sm font-medium leading-relaxed max-w-xs">
                                Deploying the Solana Vault smart contract state. This process derives all Program Derived Addresses (PDAs) and sets global fee constants.
                            </p>
                            <div className="flex items-center gap-3">
                                <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Network</span>
                                <span className="text-black font-black uppercase tracking-widest text-[10px]">Devnet v1.02</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className="p-8 lg:p-12 space-y-8 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Configuration Profile</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground">Advanced Mode</span>
                                <button
                                    onClick={() => setShowAdvancedInit(!showAdvancedInit)}
                                    className={clsx(
                                        "w-10 h-5 rounded-full p-1 transition-all duration-300",
                                        showAdvancedInit ? "bg-primary" : "bg-secondary"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-3 h-3 rounded-full bg-white transition-all transform",
                                        showAdvancedInit ? "translate-x-5" : "translate-x-0"
                                    )} />
                                </button>
                            </div>
                        </div>

                        <form className="space-y-6" onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const dev1Wallet = formData.get('dev1Wallet') as string;
                            const dev2Wallet = formData.get('dev2Wallet') as string;
                            const dev3Wallet = formData.get('dev3Wallet') as string;
                            const marketer1Wallet = formData.get('marketer1Wallet') as string;

                            const params = {
                                companyWallet: formData.get('companyWallet') as string,
                                dev1Wallet,
                                dev1Authority: showAdvancedInit ? (formData.get('dev1Authority') as string) : dev1Wallet,
                                dev2Wallet,
                                dev2Authority: showAdvancedInit ? (formData.get('dev2Authority') as string) : dev2Wallet,
                                dev3Wallet,
                                dev3Authority: showAdvancedInit ? (formData.get('dev3Authority') as string) : dev3Wallet,
                                marketer1Wallet,
                                marketer1Authority: showAdvancedInit ? (formData.get('marketer1Authority') as string) : marketer1Wallet,
                                usdcMint: formData.get('usdcMint') as string,
                            };
                            toast.loading("Deploying Initial State...", { id: 'init' });
                            try {
                                await initialize(params);
                                toast.success("Genesis complete! Vault initialized.", { id: 'init' });
                            } catch (err: any) {
                                console.error('Initialization failed:', err);
                                toast.error("Deployment failed: " + err.message, { id: 'init' });
                            }
                        }}>
                            <div className="space-y-6">
                                <InputField label="USDC Mint (SPL)" name="usdcMint" defaultValue="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" />
                                <InputField label="Company Vault Wallet" name="companyWallet" defaultValue={publicKey?.toBase58()} />

                                <div className="h-px bg-border/50 my-2" />

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-4">
                                            <InputField label="Dev Alpha Wallet" name="dev1Wallet" defaultValue={publicKey?.toBase58()} />
                                            {showAdvancedInit && <InputField label="Dev Alpha Claim Authority" name="dev1Authority" defaultValue={publicKey?.toBase58()} />}
                                        </div>
                                        <div className="space-y-4">
                                            <InputField label="Dev Beta Wallet" name="dev2Wallet" defaultValue={publicKey?.toBase58()} />
                                            {showAdvancedInit && <InputField label="Dev Beta Claim Authority" name="dev2Authority" defaultValue={publicKey?.toBase58()} />}
                                        </div>
                                        <div className="space-y-4">
                                            <InputField label="Dev Gamma Wallet" name="dev3Wallet" defaultValue={publicKey?.toBase58()} />
                                            {showAdvancedInit && <InputField label="Dev Gamma Claim Authority" name="dev3Authority" defaultValue={publicKey?.toBase58()} />}
                                        </div>
                                        <div className="space-y-4">
                                            <InputField label="Lead Marketer Wallet" name="marketer1Wallet" defaultValue={publicKey?.toBase58()} />
                                            {showAdvancedInit && <InputField label="Marketer Claim Authority" name="marketer1Authority" defaultValue={publicKey?.toBase58()} />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="group w-full bg-black text-white py-5 rounded-3xl font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-black/90 active:scale-[0.98] transition-all shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                Initialize Protocol
                            </button>
                        </form>

                        <button
                            onClick={() => refresh()}
                            className="w-full text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Force Pulse Deployment Check
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Monitor', icon: LayoutDashboard },
        { id: 'positions', label: 'Liquidity', icon: Layers },
        { id: 'swap', label: 'Exchange', icon: Repeat },
        { id: 'bonus', label: 'Incentives', icon: Gift },
        { id: 'fees', label: 'Treasury', icon: DollarSign },
        { id: 'config', label: 'System', icon: Settings },
        { id: 'users', label: 'Accounts', icon: Users },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-[45] lg:hidden animate-in fade-in duration-500"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-500 flex flex-col shadow-2xl lg:shadow-none",
                isSidebarOpen ? "w-64 translate-x-0" : "w-20 lg:translate-x-0 -translate-x-full"
            )}>
                {/* Sidebar Brand / Toggle Section */}
                <div className="h-20 lg:h-24 px-4 lg:px-6 flex items-center justify-between border-b border-border/50 lg:border-none">
                    <div className={clsx(
                        "flex items-center gap-2 transition-opacity duration-300",
                        !isSidebarOpen && "opacity-0 invisible w-0"
                    )}>
                        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] shrink-0">
                            <Shield className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <span className="font-black italic text-lg lg:text-xl tracking-tighter uppercase whitespace-nowrap">VAULT</span>
                    </div>

                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-secondary rounded-xl transition-colors shrink-0"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                <nav className="flex-1 px-3 space-y-1.5 pt-6 overflow-y-auto custom-scrollbar">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                }}
                                className={clsx(
                                    "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all group overflow-hidden relative",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-[0_12px_48px_rgba(var(--primary-rgb),0.2)]"
                                        : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20" />}
                                <Icon className={clsx("w-5 h-5 shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                                <span className={clsx(
                                    "transition-all duration-300 whitespace-nowrap",
                                    !isSidebarOpen && "opacity-0 invisible w-0 -translate-x-4"
                                )}>
                                    {tab.label}
                                </span>
                                {isActive && isSidebarOpen && <ChevronRight className="ml-auto w-4 h-4 opacity-40 shrink-0" />}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto border-t border-border">
                    <div className={clsx("p-4 rounded-2xl bg-secondary/50 space-y-3 transition-all", !isSidebarOpen && "lg:px-2")}>
                        <div className={clsx("flex items-center gap-3", !isSidebarOpen && "lg:justify-center")}>
                            <div className="w-8 h-8 rounded-full bg-background border border-border overflow-hidden shrink-0">
                                <div className="w-full h-full bg-gradient-to-br from-primary to-primary/20" />
                            </div>
                            <div className={clsx("transition-all overflow-hidden whitespace-nowrap", !isSidebarOpen && "lg:w-0")}>
                                <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-60">Admin</p>
                                <p className="text-[10px] text-foreground truncate font-mono max-w-[100px]">{publicKey?.toBase58().slice(0, 6)}...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={clsx(
                "flex-1 transition-all duration-500 flex flex-col min-w-0 min-h-screen",
                "ml-0 lg:ml-20",
                isSidebarOpen && "lg:ml-64"
            )}>
                <header className="h-20 lg:h-24 px-3 lg:px-8 border-b border-border flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-40">
                    <div className="flex items-center gap-2 lg:gap-4">
                        {!isSidebarOpen && (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 hover:bg-secondary rounded-xl transition-colors shrink-0 lg:hidden"
                            >
                                <Menu className="w-5 h-5 lg:w-6 lg:h-6" />
                            </button>
                        )}
                        <h1 className="text-lg lg:text-3xl font-black italic tracking-tighter uppercase flex items-center gap-1.5 lg:gap-3 truncate min-w-0 flex-1">
                            <span className="truncate pr-1">{tabs.find(t => t.id === activeTab)?.label}</span>
                            <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),1)] shrink-0" />
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                        <button
                            onClick={refresh}
                            className="bg-secondary p-2 lg:p-3.5 rounded-xl lg:rounded-2xl hover:bg-secondary/80 transition-all group active:scale-95 shrink-0"
                        >
                            <RefreshCw className={clsx("w-4 h-4 lg:w-5 lg:h-5", loading && "animate-spin")} />
                        </button>
                        <div className="scale-90 lg:scale-100 hidden sm:block">
                            <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-xl lg:!rounded-2xl !h-10 lg:!h-12 !font-black !uppercase !tracking-widest !text-[10px] lg:!text-xs !border-none !shadow-xl hover:!opacity-90 active:!scale-95 transition-all" />
                        </div>
                        <div className="sm:hidden">
                            <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-lg !h-9 !text-[9px] !px-3 !font-black !uppercase" />
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-8 pb-32 flex-1 overflow-x-hidden">
                    <div className="max-w-6xl mx-auto w-full">
                        {activeTab === 'overview' && <OverviewTab vaultState={vaultState} globalConfig={globalConfig} referralPoolTotal={referralPoolTotal} totalUsers={totalUsersCount} />}
                        {activeTab === 'positions' && <PositionsTab />}
                        {activeTab === 'swap' && <SwapTab />}
                        {activeTab === 'bonus' && <BonusTab />}
                        {activeTab === 'fees' && <FeesTab globalConfig={globalConfig} referralPoolTotal={referralPoolTotal} />}
                        {activeTab === 'config' && <ConfigTab globalConfig={globalConfig} />}
                        {activeTab === 'users' && <UserManagementTab />}
                    </div>
                </div>

                {/* Footer / Status Bar */}
                <footer className={clsx(
                    "h-10 fixed bottom-0 right-0 border-t border-border bg-card flex items-center px-4 lg:px-6 gap-3 lg:gap-6 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.1)] transition-all duration-500",
                    "left-0 lg:left-20",
                    isSidebarOpen && "lg:left-64"
                )}>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Live Network</span>
                    </div>
                    <div className="h-4 w-px bg-border xs:block hidden" />
                    <div className="hidden sm:flex items-center gap-2">
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">v2.1 Stable</span>
                    </div>
                    <div className="hidden md:ml-auto md:flex items-center gap-1">
                        <span className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Identity: {vaultState?.publicKey?.toBase58().slice(0, 8)}</span>
                    </div>
                </footer>
            </main>
        </div>
    );
}
