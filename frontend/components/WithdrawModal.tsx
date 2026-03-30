'use client';

import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useVault } from '@/hooks/useVault';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
    const { userAccount, vaultState, globalConfig, withdraw, closeUserAccount, loading, refresh, publicKey } = useVault();
    const [shares, setShares] = useState('');
    const [closeAfterWithdraw, setCloseAfterWithdraw] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refresh vault state when modal opens so we have latest data (e.g. after simulate_yield)
    useEffect(() => {
        if (isOpen) refresh();
    }, [isOpen, refresh]);

    const handleWithdraw = async () => {
        setError(null);
        try {
            if (!shares || isNaN(Number(shares))) return;
            await withdraw(Number(shares));

            if (closeAfterWithdraw && publicKey) {
                // Wait a bit for the withdrawal to hit the blockchain state if needed, 
                // or just try closing immediately if shares == total_shares.
                const remaining = (userAccount ? Number(userAccount.shares) : 0) - Math.round(Number(shares) * 1e9);
                if (remaining <= 0) {
                    await closeUserAccount(publicKey.toBase58(), publicKey.toBase58());
                }
            }

            onClose();
        } catch (err: any) {
            setError(err.message || 'Withdraw failed');
        }
    };

    // Calculate real numbers - match program scaling exactly
    const availableSharesRaw = userAccount ? Number(userAccount.shares) : 0;
    const availableShares = availableSharesRaw / 1e9;
    const totalSharesRaw = vaultState ? Number(vaultState.totalShares) : 0;
    const totalTvlRaw = vaultState ? Number(vaultState.totalTvl) : 0;

    // Share price: program uses (total_tvl * 1e9) / total_shares
    const sharePriceRaw = totalSharesRaw > 0 ? (totalTvlRaw * 1e9) / totalSharesRaw : 1e6;
    const sharePriceDollars = sharePriceRaw / 1e6; // USDC 6-dec to dollars

    const inputShares = Number(shares) || 0;
    const inputSharesRaw = Math.round(inputShares * 1e9);
    const currentValue = (inputSharesRaw * sharePriceRaw) / 1e9 / 1e6; // Match program: shares * share_price / 1e9, then to dollars

    // Cost basis: program entry_value = shares * entry_price / 1e9 (USDC 6-dec)
    const entryValueRaw = userAccount ? (inputSharesRaw * Number(userAccount.entryPrice)) / 1e9 : 0;
    const proratedDeposit = entryValueRaw / 1e6; // USDC to dollars
    // Show signed profit (can be negative) for UX; program charges fees only on positive profit
    const profitSigned = currentValue - proratedDeposit;

    // Match on-chain tier logic from globalConfig
    // active_deposit_value = remaining_shares * share_price
    const remainingShares = Math.max(0, availableShares - inputShares);
    const activeDepositValue = remainingShares * sharePriceDollars; // in dollars

    const tier1Threshold = globalConfig?.tier1Threshold ? Number(globalConfig.tier1Threshold) / 1e6 : 100;
    const tier2Threshold = globalConfig?.tier2Threshold ? Number(globalConfig.tier2Threshold) / 1e6 : 500;
    const tier1Fee = (globalConfig?.tier1Fee || 70) / 100;
    const tier2Fee = (globalConfig?.tier2Fee || 60) / 100;
    const tier3Fee = (globalConfig?.tier3Fee || 50) / 100;

    let feeTierPercent = tier1Fee;
    if (activeDepositValue < tier1Threshold) {
        feeTierPercent = tier1Fee;
    } else if (activeDepositValue < tier2Threshold) {
        feeTierPercent = tier2Fee;
    } else {
        feeTierPercent = tier3Fee;
    }

    const feeAmount = profitSigned > 0 ? profitSigned * feeTierPercent : 0;
    const netReceive = currentValue - feeAmount;

    // Note: Profit/fee are $0 when share price hasn't increased (no yield). Run simulate_yield (admin) to test.

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Withdraw Funds">
            <div className="space-y-6">
                <p className="text-xs text-muted-foreground">
                    Ensure your connected wallet has SOL for transaction fees (~0.0001 SOL).
                </p>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Shares Amount</label>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="0.00"
                            value={shares}
                            onChange={(e) => setShares(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 pl-3 pr-16 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="absolute right-3 top-2.5 text-sm font-medium text-muted-foreground">
                            Shares
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Available: {availableShares.toFixed(2)} Shares</span>
                        <button
                            className="text-primary hover:underline"
                            onClick={() => setShares(availableShares.toString())}
                        >
                            Max
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">
                        {error}
                    </div>
                )}

                <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
                    <h4 className="font-medium mb-2">Fee Breakdown</h4>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Gross Value</span>
                        <span>${currentValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Prorated Deposit</span>
                        <span>${proratedDeposit.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between ${profitSigned >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <span>Profit</span>
                        <span>{profitSigned >= 0 ? `+${profitSigned.toFixed(2)}` : `-${Math.abs(profitSigned).toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between text-destructive">
                        <span>Performance Fee ({feeTierPercent * 100}%)</span>
                        <span>-${feeAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold text-base mt-2">
                        <span>You Receive</span>
                        <span>${netReceive.toFixed(2)}</span>
                    </div>
                    {profitSigned <= 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Profit is $0 when share price hasn&apos;t increased. Performance fee applies only on profits.
                        </p>
                    )}
                </div>

                {shares && Number(shares) >= availableShares && Number(userAccount?.unclaimedReferralEarnings || 0) === 0 && (
                    <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg border border-border">
                        <input
                            type="checkbox"
                            id="closeAccount"
                            checked={closeAfterWithdraw}
                            onChange={(e) => setCloseAfterWithdraw(e.target.checked)}
                            className="h-4 w-4 bg-background border-input rounded focus:ring-primary"
                        />
                        <label htmlFor="closeAccount" className="text-xs text-muted-foreground cursor-pointer">
                            Close my account after withdrawal to reclaim rent (~0.002 SOL)
                        </label>
                    </div>
                )}

                <button
                    onClick={handleWithdraw}
                    disabled={loading || !shares || Number(shares) <= 0 || Number(shares) > availableShares}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm Withdraw
                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </button>
            </div>
        </Modal>
    );
}
