'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { StatCard } from '@/components/StatCard';
import { ReferralTree } from '@/components/ReferralTree';
import { Copy, Share2, Users, DollarSign, Gift, CheckCheck, Loader2, Shield, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useVault } from '@/hooks/useVault';

export default function ReferralPage() {
    const { connection } = useConnection();
    const { connected, publicKey } = useWallet();
    const { userAccount, referrals, claimReferralEarnings, loading, isInitialized, refresh, globalConfig } = useVault();
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Mock code based on wallet
    const referralCode = connected ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${publicKey?.toBase58()}` : 'Connect wallet to generate';

    const handleCopy = () => {
        if (!connected) return;
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClaim = async () => {
        setError(null);
        try {
            await claimReferralEarnings();
        } catch (err: any) {
            setError(err.message || 'Claim failed');
        }
    };

    if (!mounted || !connected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-blue-500/10 p-4 rounded-full mb-6">
                    <Shield className="w-12 h-12 text-blue-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Connect Your Wallet
                </h1>
                <p className="text-muted-foreground mb-8 max-w-md">
                    Connect your wallet to view your referral earnings and generate your unique referral link.
                </p>
                <div className="bg-[#512da8] hover:bg-[#4527a0] transition-colors rounded-lg overflow-hidden">
                    {mounted && <WalletMultiButton />}
                </div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-amber-500/10 p-4 rounded-full mb-6">
                    <Shield className="w-12 h-12 text-amber-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Vault Not Initialized
                </h1>
                <p className="text-muted-foreground mb-8 max-w-md">
                    The Caifu protocol has not been initialized on this network ({connection.rpcEndpoint}).
                    Please ensure the program is deployed and the `initialize` instruction has been run.
                </p>
                <button
                    onClick={() => refresh()}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
                >
                    <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                    Refresh Status
                </button>
            </div>
        );
    }

    if (!userAccount) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
                <div className="rounded-full bg-red-500/10 p-6">
                    <Users className="h-12 w-12 text-red-400" />
                </div>
                <h1 className="text-3xl font-bold">Access Restricted</h1>
                <p className="text-muted-foreground max-w-md">
                    This wallet is not registered. Account registration is managed by the admin —
                    please contact the admin to be whitelisted before you can access referrals or earnings.
                </p>
            </div>
        );
    }

    const unclaimed = Number(userAccount.unclaimedReferralEarnings) / 1e6;
    const totalEarned = Number(userAccount.totalReferralEarnings) / 1e6;
    const totalReferralsCount = referrals.length;

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Referrals</h1>
                    <p className="text-muted-foreground">Earn fees from up to 5 levels of your network.</p>
                </div>
                <div className="flex items-center gap-2 bg-card border border-border p-2 rounded-lg">
                    <code className="text-sm bg-secondary px-2 py-1 rounded text-muted-foreground">{referralCode}</code>
                    <button onClick={handleCopy} className="p-2 hover:bg-accent rounded-md transition-colors" title="Copy Link">
                        {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button className="p-2 hover:bg-accent rounded-md transition-colors" title="Share">
                        <Share2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Referrals" value={totalReferralsCount.toString()} icon={Users} />
                <StatCard label="Active Users" value={totalReferralsCount.toString()} icon={Users} />
                <StatCard label="Lifetime Earnings" value={`$${totalEarned.toFixed(2)}`} icon={DollarSign} />
                <StatCard label="Unclaimed Rewards" value={`$${unclaimed.toFixed(2)}`} icon={Gift} />
            </div>

            {error && (
                <div className="bg-red-500/10 text-red-500 p-4 rounded-lg text-sm border border-red-500/20">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <ReferralTree referrals={referrals} />

                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold">Referral Details</h3>
                            <span className="text-xs text-muted-foreground">{totalReferralsCount} Total</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-secondary/30 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Level</th>
                                        <th className="px-6 py-4">Contribution</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {referrals.length > 0 ? (
                                        referrals.map((ref: any, i: number) => (
                                            <ReferralTableRow key={i} data={ref} />
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">
                                                No referral activity found yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                        <h3 className="text-lg font-bold">Claim Rewards</h3>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Available</span>
                            <span className="font-bold text-xl">${unclaimed.toFixed(2)}</span>
                        </div>
                        <button
                            onClick={handleClaim}
                            disabled={loading || unclaimed <= 0}
                            className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Claim to Wallet
                        </button>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                        <h3 className="text-lg font-bold">Commission Rates</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Level 1 (Direct)</span> <span className="font-medium">{globalConfig?.referralL1Share || 40}%</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Level 2</span> <span className="font-medium">{globalConfig?.referralL2Share || 25}%</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Level 3</span> <span className="font-medium">{globalConfig?.referralL3Share || 15}%</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Level 4</span> <span className="font-medium">{globalConfig?.referralL4Share || 12}%</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Level 5</span> <span className="font-medium">{globalConfig?.referralL5Share || 8}%</span></div>
                            <p className="text-xs text-muted-foreground pt-2 italic">Percentages of the {globalConfig?.referralPoolShare || 10}% referral pool.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReferralTableRow({ data }: { data: any }) {
    const walletStr = data.wallet.toBase58();
    const shortWallet = `${walletStr.slice(0, 8)}...${walletStr.slice(-8)}`;
    const earnings = (Number(data.totalReferralEarnings) / 1e6).toFixed(2);

    return (
        <>
            <tr className="hover:bg-secondary/10 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{shortWallet}</td>
                <td className="px-6 py-4 text-xs">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">L{data.level}</span>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-green-500">${earnings}</td>
                <td className="px-6 py-4 text-right">
                    <button className="text-xs text-muted-foreground hover:text-white transition-colors">View Detail</button>
                </td>
            </tr>
            {data.children?.map((child: any, i: number) => (
                <ReferralTableRow key={`${data.level}-${i}`} data={child} />
            ))}
        </>
    );
}
