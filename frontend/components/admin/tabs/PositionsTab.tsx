'use client';

import { useState } from 'react';
import { Layers, RefreshCw, Loader2, Play, Search, Plus } from 'lucide-react';
import { clsx } from "clsx";
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';
import { InputField } from '@/components/admin/InputField';
import { RebalanceModal } from '@/components/admin/RebalanceModal';

export function PositionsTab() {
    const { vaultState, openDlmmPosition, activePositions, loading } = useVault();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

    // Form State
    const [poolAddress, setPoolAddress] = useState('');
    const [minBinId, setMinBinId] = useState('');
    const [maxBinId, setMaxBinId] = useState('');
    const [amountX, setAmountX] = useState(''); // SOL
    const [amountY, setAmountY] = useState(''); // USDC
    const [strategy, setStrategy] = useState('0'); // 0: Spot

    const handleOpenPosition = async () => {
        try {
            await openDlmmPosition(
                poolAddress,
                Number(minBinId),
                Number(maxBinId),
                Number(amountX),
                Number(amountY),
                Number(strategy)
            );
            toast.success('Position opened successfully!');
            setIsFormOpen(false);
        } catch (e: any) {
            console.error(e);
            toast.error('Failed to open position: ' + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        DLMM Positions
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage active liquidity provider positions on Meteora.</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg"
                >
                    {isFormOpen ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isFormOpen ? 'Cancel' : 'New Position'}
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold mb-6">Open New RLMM Position</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <InputField label="Pool Address" name="poolAddress" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="Meteora DLMM Pool Address" />
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Min Bin ID" name="minBinId" value={minBinId} onChange={(e) => setMinBinId(e.target.value)} placeholder="-100" />
                            <InputField label="Max Bin ID" name="maxBinId" value={maxBinId} onChange={(e) => setMaxBinId(e.target.value)} placeholder="100" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Amount X (Base)" name="amountX" value={amountX} onChange={(e) => setAmountX(e.target.value)} placeholder="0.0" />
                            <InputField label="Amount Y (Quote)" name="amountY" value={amountY} onChange={(e) => setAmountY(e.target.value)} placeholder="0.0" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Strategy Type</label>
                            <select
                                value={strategy}
                                onChange={(e) => setStrategy(e.target.value)}
                                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                            >
                                <option value="0">Spot (Standard)</option>
                                <option value="1">Curve (Balanced)</option>
                                <option value="2">Bid-Ask (High Volatility)</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleOpenPosition}
                        disabled={loading}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        Execute Open Position
                    </button>
                </div>
            )}

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                {!activePositions || activePositions.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                        <div className="bg-secondary/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <Layers className="text-muted-foreground w-8 h-8 opacity-20" />
                        </div>
                        <p className="text-muted-foreground">No active DLMM positions found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                    <th className="px-6 py-4">Index</th>
                                    <th className="px-6 py-4 text-center">Pool</th>
                                    <th className="px-6 py-4">Strategy</th>
                                    <th className="px-6 py-4">Bin Range</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {activePositions.map((pos: any, idx: number) => (
                                    <PositionRow
                                        key={pos.publicKey.toBase58()}
                                        position={pos}
                                        index={idx}
                                        onRebalance={() => {
                                            setSelectedPosition(pos);
                                            setIsRebalanceModalOpen(true);
                                        }}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <RebalanceModal
                isOpen={isRebalanceModalOpen}
                onClose={() => setIsRebalanceModalOpen(false)}
                position={selectedPosition}
            />
        </div>
    );
}

function PositionRow({ position, index, onRebalance }: { position: any, index: number, onRebalance: () => void }) {
    const { closeDlmmPosition, closeDlmmPositionAccount, claimDlmmFees, loading } = useVault();
    const [closing, setClosing] = useState(false);

    const handleClose = async () => {
        if (!confirm('Are you sure you want to close this position? Funds will return to the vault.')) return;
        setClosing(true);
        toast.loading('Closing Position...', { id: 'close-pos' });
        try {
            await closeDlmmPosition(position.publicKey.toBase58());
            toast.success('Position closed successfully!', { id: 'close-pos' });
        } catch (e: any) {
            console.error(e);
            toast.error('Failed to close position: ' + e.message, { id: 'close-pos' });
        } finally {
            setClosing(false);
        }
    };

    const strategyLabel = position.account.mode.spot ? 'Spot' :
        position.account.mode.bidAsk ? 'Bid-Ask' :
            position.account.mode.curve ? 'Curve' : 'Unknown';
    const poolTrunc = position.account.dlmmPool.toBase58().slice(0, 6) + '...' + position.account.dlmmPool.toBase58().slice(-6);

    return (
        <tr className="hover:bg-accent/5 transition-colors group">
            <td className="px-6 py-4 font-medium">
                <span className="bg-secondary/50 px-2 py-1 rounded text-xs text-muted-foreground mr-1">#{index + 1}</span>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                    <span className="font-mono text-xs text-foreground font-semibold">{poolTrunc}</span>
                    <button
                        onClick={() => navigator.clipboard.writeText(position.account.dlmmPool.toBase58())}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    >
                        Copy Address
                    </button>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className={clsx(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    strategyLabel === 'Spot' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        strategyLabel === 'Curve' ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" :
                            "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                )}>
                    {strategyLabel}
                </span>
            </td>
            <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                {position.account.binIdLower} <span className="mx-1 text-muted-foreground/30">→</span> {position.account.binIdUpper}
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onRebalance}
                        className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-primary/20"
                    >
                        Rebalance
                    </button>
                    <button
                        onClick={async () => {
                            toast.loading('Harvesting Fees...', { id: 'harvest' });
                            try {
                                await claimDlmmFees(position.publicKey.toBase58());
                                toast.success('Fees harvested to vault!', { id: 'harvest' });
                            } catch (e: any) {
                                toast.error('Harvest failed: ' + e.message, { id: 'harvest' });
                            }
                        }}
                        disabled={loading || closing}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/20 disabled:opacity-50"
                    >
                        Harvest Fees
                    </button>
                    <button
                        onClick={handleClose}
                        disabled={loading || closing}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/20 disabled:opacity-50"
                    >
                        {closing ? '...' : 'Close'}
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await closeDlmmPositionAccount(position.publicKey.toBase58());
                                toast.success("Position cleaned up!");
                            } catch (e: any) {
                                toast.error(e.message);
                            }
                        }}
                        className="bg-secondary p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-border"
                        title="Reclaim Rent"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
}
