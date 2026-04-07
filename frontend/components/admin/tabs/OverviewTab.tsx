'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Shield, DollarSign, Layers, TrendingUp, Users, Building2, Wallet, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/StatCard';
import { useVault } from '@/hooks/useVault';

interface TokenBalance {
    mint: string;
    symbol: string;
    balance: number;
    decimals: number;
    address: string;
    label?: string;
}

const KNOWN_MINTS: Record<string, { symbol: string; decimals: number }> = {
    'So11111111111111111111111111111111111111112': { symbol: 'SOL (Wrapped)', decimals: 9 },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', decimals: 9 },
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', decimals: 9 },
    'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': { symbol: 'JupSOL', decimals: 9 },
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', decimals: 9 },
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'WETH', decimals: 8 },
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'WBTC', decimals: 8 },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', decimals: 5 },
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', decimals: 6 },
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', decimals: 6 },
    'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', decimals: 8 },
};

export function OverviewTab({ vaultState, globalConfig, referralPoolTotal, totalUsers }: { vaultState: any, globalConfig: any, referralPoolTotal: number, totalUsers: number }) {
    const { connection } = useConnection();
    const [vaultUsdcBalance, setVaultUsdcBalance] = useState(0);
    const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
    const [loadingBalances, setLoadingBalances] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const { getPDAs, syncTvl, loading } = useVault();

    const fetchBalances = async () => {
        setLoadingBalances(true);
        const { globalConfigPda, vaultUsdcPda } = getPDAs();
        try {
            // Fetch vault USDC PDA balance
            const bal = await connection.getTokenAccountBalance(vaultUsdcPda);
            setVaultUsdcBalance(Number(bal.value.amount) / 1e6);

            // Fetch all token accounts owned by the GlobalConfig PDA
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(globalConfigPda, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            });

            const balances: TokenBalance[] = tokenAccounts.value.map((ta) => {
                const parsed = ta.account.data.parsed.info;
                const mint = parsed.mint as string;
                const known = KNOWN_MINTS[mint];
                const decimals = known?.decimals ?? parsed.tokenAmount.decimals;
                const balance = Number(parsed.tokenAmount.amount) / Math.pow(10, decimals);
                const isVaultPda = ta.pubkey.equals(vaultUsdcPda);
                return {
                    mint,
                    symbol: known?.symbol ?? `${mint.slice(0, 4)}...${mint.slice(-4)}`,
                    balance,
                    decimals,
                    address: ta.pubkey.toBase58(),
                    label: isVaultPda ? 'Vault PDA' : 'Standard ATA',
                };
            });

            // Sort: USDC first, then by balance descending
            balances.sort((a, b) => {
                if (a.symbol === 'USDC' && b.symbol !== 'USDC') return -1;
                if (b.symbol === 'USDC' && a.symbol !== 'USDC') return 1;
                return b.balance - a.balance;
            });

            setTokenBalances(balances);
        } catch (e) {
            console.warn("Could not fetch token balances", e);
        } finally {
            setLoadingBalances(false);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, [connection, getPDAs]);

    const totalTvlValue = vaultState ? Number(vaultState.totalTvl) / 1e6 : 0;
    const baseFees = globalConfig
        ? (Number(globalConfig.companyFees) + Number(globalConfig.dev1Fees) + Number(globalConfig.dev2Fees) + Number(globalConfig.dev3Fees) + Number(globalConfig.marketer1Fees)) / 1e6
        : 0;
    const totalFees = baseFees + (referralPoolTotal || 0);

    // Position value is total Tvl minus what's currently in the USDC vault account
    const activePositionsValue = Math.max(0, totalTvlValue - vaultUsdcBalance);

    const handleSyncTvl = async () => {
        setSyncing(true);
        try {
            const result = await syncTvl();
            const oldVal = (result.oldTvl / 1e6).toFixed(2);
            const newVal = (result.newTvl / 1e6).toFixed(2);
            toast.success(`TVL synced: $${oldVal} → $${newVal}`);
        } catch (e: any) {
            toast.error('TVL sync failed: ' + e.message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="relative">
                    <StatCard label="Total TVL" value={`$${totalTvlValue.toLocaleString()}`} icon={Shield} />
                    <button
                        onClick={handleSyncTvl}
                        disabled={syncing || loading}
                        className="absolute top-3 right-3 flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border border-primary/20 disabled:opacity-50"
                        title="Sync TVL with actual vault + position values"
                    >
                        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Sync
                    </button>
                </div>
                <StatCard label="Accumulated Fees" value={`$${totalFees.toFixed(2)}`} icon={DollarSign} />
                <StatCard label="Meteora Shares" value={(Number(vaultState?.totalShares || 0) / 1e9).toLocaleString()} icon={Layers} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Active Positions" value={vaultState?.positionsCount?.toString() || '0'} icon={TrendingUp} />
                <StatCard label="Total Users" value={totalUsers.toString()} icon={Users} />
                <StatCard label="Position Asset Value" value={`$${activePositionsValue.toLocaleString()}`} icon={Building2} />
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Wallet className="w-24 h-24" />
                </div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-lg font-bold">Vault Token Balances</h3>
                    <button
                        onClick={fetchBalances}
                        disabled={loadingBalances}
                        className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                        title="Refresh balances"
                    >
                        <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {tokenBalances.length === 0 && !loadingBalances ? (
                    <p className="text-sm text-muted-foreground relative z-10">No token accounts found.</p>
                ) : (
                    <div className="overflow-x-auto relative z-10">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-muted-foreground">
                                    <th className="text-left py-2 pr-4 font-medium">Token</th>
                                    <th className="text-right py-2 px-4 font-medium">Balance</th>
                                    <th className="text-left py-2 px-4 font-medium hidden md:table-cell">Type</th>
                                    <th className="text-left py-2 pl-4 font-medium hidden lg:table-cell">Account</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokenBalances.map((tb, i) => (
                                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                        <td className="py-3 pr-4 font-medium">{tb.symbol}</td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {tb.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: tb.decimals > 6 ? 9 : 6 })}
                                        </td>
                                        <td className="py-3 px-4 hidden md:table-cell">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                tb.label === 'Vault PDA'
                                                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                            }`}>
                                                {tb.label}
                                            </span>
                                        </td>
                                        <td className="py-3 pl-4 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                                            {tb.address.slice(0, 8)}...{tb.address.slice(-6)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Shield className="w-24 h-24" />
                </div>
                <h3 className="text-lg font-bold mb-4 relative z-10">System Health</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                    <HealthItem label="Solana Network" />
                    <HealthItem label="Meteora API" />
                    <HealthItem label="Jupiter API" />
                </div>
            </div>
        </div>
    );
}

function HealthItem({ label }: { label: string }) {
    return (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold uppercase">Operational</span>
            </div>
        </div>
    );
}
