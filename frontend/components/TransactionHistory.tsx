'use client';

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { Loader2, ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from 'lucide-react';

export function TransactionHistory() {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        if (!publicKey) return;
        setLoading(true);
        try {
            // Fetch signatures for the user's wallet
            // For a production app, we might filter by the program ID or index them off-chain.
            // Here we just list recent transactions for the connected wallet.
            // Ideally, we filter for transactions involving the vault program.
            const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });

            const txs = signatures.map(sig => ({
                signature: sig.signature,
                slot: sig.slot,
                err: sig.err,
                memo: sig.memo,
                blockTime: sig.blockTime
            }));

            setTransactions(txs);
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (publicKey) {
            fetchHistory();
        }
    }, [publicKey, connection]);

    if (!publicKey) return null;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Recent Transactions</h2>
                <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                    <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {transactions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No recent transactions found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Signature</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transactions.map((tx) => (
                                    <tr key={tx.signature} className="hover:bg-accent/5">
                                        <td className="px-6 py-4 font-mono text-xs">
                                            <a
                                                href={`https://explorer.solana.com/tx/${tx.signature}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-primary hover:underline"
                                            >
                                                {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </td>
                                        <td className="px-6 py-4">
                                            {tx.err ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-500">
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500">
                                                    Success
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                                            {tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Pending'}
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
