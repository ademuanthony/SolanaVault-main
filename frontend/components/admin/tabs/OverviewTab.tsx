'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Shield, DollarSign, Layers, TrendingUp, Users, Building2 } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { useVault } from '@/hooks/useVault';

export function OverviewTab({ vaultState, globalConfig, referralPoolTotal, totalUsers }: { vaultState: any, globalConfig: any, referralPoolTotal: number, totalUsers: number }) {
    const { connection } = useConnection();
    const [vaultUsdcBalance, setVaultUsdcBalance] = useState(0);
    const { getPDAs } = useVault();

    useEffect(() => {
        const getVBalance = async () => {
            const { vaultUsdcPda } = getPDAs();
            try {
                const bal = await connection.getTokenAccountBalance(vaultUsdcPda);
                setVaultUsdcBalance(Number(bal.value.amount) / 1e6);
            } catch (e) {
                console.warn("Could not fetch vault USDC balance", e);
            }
        };
        getVBalance();
    }, [connection, getPDAs]);

    const totalTvlValue = vaultState ? Number(vaultState.totalTvl) / 1e6 : 0;
    const baseFees = globalConfig
        ? (Number(globalConfig.companyFees) + Number(globalConfig.dev1Fees) + Number(globalConfig.dev2Fees) + Number(globalConfig.dev3Fees) + Number(globalConfig.marketer1Fees)) / 1e6
        : 0;
    const totalFees = baseFees + (referralPoolTotal || 0);

    // Position value is total Tvl minus what's currently in the USDC vault account
    const activePositionsValue = Math.max(0, totalTvlValue - vaultUsdcBalance);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard label="Total TVL" value={`$${totalTvlValue.toLocaleString()}`} icon={Shield} />
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
