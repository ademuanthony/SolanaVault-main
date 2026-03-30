import { useState, useEffect } from 'react';
import { useVault } from '@/hooks/useVault';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Settings2, ArrowRight, TrendingUp } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { InputField } from '@/components/admin/InputField';

interface RebalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    position: any;
}

export function RebalanceModal({ isOpen, onClose, position }: RebalanceModalProps) {
    const { closeDlmmPosition, openDlmmPosition, loading: vaultLoading, fetchState } = useVault();
    const [step, setStep] = useState(1); // 1: Config, 2: Executing

    const [newMinBin, setNewMinBin] = useState(position?.account?.binIdLower?.toString() || '');
    const [newMaxBin, setNewMaxBin] = useState(position?.account?.binIdUpper?.toString() || '');
    const [newStrategy, setNewStrategy] = useState(
        position?.account?.mode?.spot ? '0' :
            position?.account?.mode?.curve ? '1' :
                position?.account?.mode?.bidAsk ? '2' : '0'
    );

    const [amountX, setAmountX] = useState('0');
    const [amountY, setAmountY] = useState('0');

    useEffect(() => {
        if (position?.account) {
            setNewMinBin(position.account.binIdLower?.toString() || '');
            setNewMaxBin(position.account.binIdUpper?.toString() || '');
            const strategy = position.account.mode?.spot ? '0' :
                position.account.mode?.curve ? '1' :
                    position.account.mode?.bidAsk ? '2' : '0';
            setNewStrategy(strategy);
        }
    }, [position]);

    const handleRebalance = async () => {
        if (!position) return;
        setStep(2);
        toast.loading('Step 1/2: Liquidity Unlocking...', { id: 'rebalance' });

        try {
            await closeDlmmPosition(position.publicKey.toBase58());
            await new Promise(r => setTimeout(r, 2000));
            await fetchState();

            toast.loading('Step 2/2: Liquidity Re-allocation...', { id: 'rebalance' });

            await openDlmmPosition(
                position.account.dlmmPool.toBase58(),
                Number(newMinBin),
                Number(newMaxBin),
                Number(amountX),
                Number(amountY),
                Number(newStrategy)
            );

            toast.success('Strategy adjusted successfully!', { id: 'rebalance' });
            onClose();
            setStep(1);
        } catch (e: any) {
            console.error(e);
            toast.error('Adjustment failed: ' + e.message, { id: 'rebalance' });
            setStep(1);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Strategic Rebalance">
            <div className="space-y-8 py-2">
                <div className="bg-secondary/40 p-5 rounded-2xl border border-border/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform">
                        <Settings2 className="w-16 h-16" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2 opacity-60">Target Meteora Pool</p>
                    <p className="font-mono text-xs break-all text-primary font-bold group-hover:text-foreground transition-colors">{position?.account?.dlmmPool?.toBase58()}</p>
                </div>

                {step === 1 ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <InputField
                                label="Min Bin ID"
                                name="minBinId"
                                value={newMinBin}
                                onChange={(e) => setNewMinBin(e.target.value)}
                                placeholder="-100"
                            />
                            <InputField
                                label="Max Bin ID"
                                name="maxBinId"
                                value={newMaxBin}
                                onChange={(e) => setNewMaxBin(e.target.value)}
                                placeholder="100"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground ml-1">Strategy Architecture</label>
                            <select
                                className="w-full bg-secondary/50 border border-border/50 rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all font-bold appearance-none"
                                value={newStrategy}
                                onChange={(e) => setNewStrategy(e.target.value)}
                            >
                                <option value="0">Spot (Standard)</option>
                                <option value="1">Curve (Balanced)</option>
                                <option value="2">Bid-Ask (Aggressive)</option>
                            </select>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Allocation (Max available in Vault)</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <InputField
                                    label="Amount X"
                                    name="amountX"
                                    value={amountX}
                                    onChange={(e) => setAmountX(e.target.value)}
                                    placeholder="0.0"
                                />
                                <InputField
                                    label="Amount Y"
                                    name="amountY"
                                    value={amountY}
                                    onChange={(e) => setAmountY(e.target.value)}
                                    placeholder="0.0"
                                />
                            </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl flex gap-3">
                            <TrendingUp className="w-6 h-6 text-amber-500 shrink-0" />
                            <p className="text-[11px] text-amber-600/80 leading-relaxed font-medium capitalize">
                                This operation will atomically exit the current bin range and re-deploy capital into the new specs. Market slippage may occur during transition.
                            </p>
                        </div>

                        <button
                            onClick={handleRebalance}
                            disabled={vaultLoading}
                            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all shadow-[0_12px_48px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50"
                        >
                            {vaultLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            Execute Tactical Rebalance
                        </button>
                    </div>
                ) : (
                    <div className="py-16 flex flex-col items-center justify-center space-y-8">
                        <div className="relative group">
                            <div className="absolute inset-x-0 inset-y-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                            <Loader2 className="w-24 h-24 text-primary animate-spin relative z-10" />
                            <Settings2 className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce transition-all" />
                        </div>
                        <div className="text-center space-y-3 relative z-10">
                            <p className="font-black text-2xl uppercase tracking-tighter">Chain State Mutating</p>
                            <p className="max-w-[320px] text-xs font-medium text-muted-foreground leading-relaxed uppercase tracking-widest opacity-60">
                                Strategic re-deployment is being verified on the Solana mainnet/devnet. Do not close this terminal.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
