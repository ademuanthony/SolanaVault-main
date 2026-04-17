'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { useVault } from '@/hooks/useVault';

interface DepositModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
    const { userAccount, vaultState, deposit, loading } = useVault();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleAction = async () => {
        setError(null);
        try {
            if (!userAccount) return;
            if (!amount || isNaN(Number(amount))) return;
            await deposit(Number(amount));
            onClose();
        } catch (err: any) {
            setError(err.message || 'Transaction failed');
        }
    };

    const tvlNum = vaultState ? Number(vaultState.totalTvl) : 0;
    const sharesNum = vaultState ? Number(vaultState.totalShares) : 0;
    const sharePrice = sharesNum > 0 ? (tvlNum * 1e3) / sharesNum : 1;
    const sharesReceived = amount ? Number(amount) / sharePrice : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={userAccount ? "Deposit USDC" : "Access Restricted"}>
            <div className="space-y-6">
                {!userAccount ? (
                    <div className="text-center space-y-4 py-4">
                        <div className="rounded-full bg-red-500/10 w-16 h-16 flex items-center justify-center mx-auto">
                            <Wallet className="h-8 w-8 text-red-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            This wallet is not registered. Account registration is managed by the admin —
                            please contact the admin to be whitelisted before you can deposit.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Amount</label>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 pl-3 pr-16 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="absolute right-3 top-2.5 text-sm font-medium text-muted-foreground">
                                USDC
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">
                        {error}
                    </div>
                )}

                <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">You Receive</span>
                        <span className="font-medium">{amount ? sharesReceived.toFixed(2) : '--'} Shares</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Exchange Rate</span>
                        <span className="font-medium">1 USDC = {(1 / sharePrice).toFixed(4)} Shares</span>
                    </div>
                </div>

                {userAccount && (
                    <button
                        onClick={handleAction}
                        disabled={loading || !amount}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Confirm Deposit
                        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </button>
                )}
            </div>
        </Modal>
    );
}
