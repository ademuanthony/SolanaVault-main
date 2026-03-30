'use client';

import { useEffect, useState } from 'react';
import { useVault, PROGRAM_ID } from '@/hooks/useVault';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Trophy, Medal, Users, TrendingUp, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { BN, Program } from "@coral-xyz/anchor";
import { SolanaVault } from '@/target/types/solana_vault';
import idl from '@/target/types/solana_vault.json';

// Minimal IDL type for fetching
interface UserAccount {
    wallet: PublicKey;
    shares: BN;
    referralEarnings: BN;
    referrer: PublicKey | null;
}

export default function LeaderboardPage() {
    const { connection } = useConnection();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'depositors' | 'referrers'>('depositors');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                // Initialize a temporary program instance just for fetching all accounts
                const provider = { connection, publicKey: PublicKey.default }; // Read-only provider
                const program = new Program(idl as any, provider) as unknown as Program<SolanaVault>;

                // Fetch all UserAccount structs
                // @ts-ignore
                const accounts = await program.account.userAccount.all();

                const parsedUsers = accounts.map((acc: any) => ({
                    wallet: acc.account.wallet.toBase58(),
                    shares: Number(acc.account.shares), // 9 decimals
                    referralEarnings: Number(acc.account.totalReferralEarnings || 0), // 6 decimals
                }));

                setUsers(parsedUsers);
            } catch (e) {
                console.error("Failed to fetch leaderboard", e);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [connection]);

    const sortedUsers = [...users].sort((a, b) => {
        if (filter === 'depositors') return b.shares - a.shares;
        return b.referralEarnings - a.referralEarnings;
    });

    const topUsers = sortedUsers.slice(0, 100); // Top 100

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent inline-flex items-center gap-3">
                    <Trophy className="h-10 w-10 text-yellow-500" />
                    Vault Leaderboard
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Recognizing the top contributors and community builders in the Solana Vault ecosystem.
                </p>
            </div>

            <div className="flex justify-center gap-4">
                <button
                    onClick={() => setFilter('depositors')}
                    className={clsx(
                        "px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2",
                        filter === 'depositors'
                            ? "bg-primary text-primary-foreground shadow-lg scale-105"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                >
                    <TrendingUp className="h-4 w-4" />
                    Top Depositors
                </button>
                <button
                    onClick={() => setFilter('referrers')}
                    className={clsx(
                        "px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2",
                        filter === 'referrers'
                            ? "bg-primary text-primary-foreground shadow-lg scale-105"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                >
                    <Users className="h-4 w-4" />
                    Top Referrers
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl max-w-4xl mx-auto min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-4">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p>Loading chain data...</p>
                    </div>
                ) : topUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Users className="h-12 w-12 mb-4 opacity-20" />
                        <p>No user records found yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-secondary/50 text-muted-foreground text-sm uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-20 text-center">Rank</th>
                                    <th className="px-6 py-4 font-semibold">User</th>
                                    <th className="px-6 py-4 font-semibold text-right">
                                        {filter === 'depositors' ? 'Shares Held' : 'Referral Earnings'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {topUsers.map((user, index) => (
                                    <tr key={user.wallet} className={clsx(
                                        "hover:bg-accent/5 transition-colors",
                                        index < 3 ? "bg-gradient-to-r from-yellow-500/5 to-transparent" : ""
                                    )}>
                                        <td className="px-6 py-4 text-center">
                                            {index === 0 && <Medal className="h-6 w-6 text-yellow-500 mx-auto" />}
                                            {index === 1 && <Medal className="h-6 w-6 text-gray-400 mx-auto" />}
                                            {index === 2 && <Medal className="h-6 w-6 text-amber-700 mx-auto" />}
                                            {index > 2 && <span className="font-mono text-muted-foreground">#{index + 1}</span>}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm">
                                            {user.wallet.slice(0, 4)}...{user.wallet.slice(-4)}
                                            {index < 3 && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Elite</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">
                                            {filter === 'depositors'
                                                ? (user.shares / 1e9).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' Shares'
                                                : '$' + (user.referralEarnings / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
