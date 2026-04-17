'use client';

import { DollarSign, Shield, Building2, Megaphone, Users, Zap, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';

export function FeesTab({ globalConfig, referralPoolTotal }: { globalConfig: any, referralPoolTotal: number }) {
    const { withdrawCompanyFees, withdrawDevFees, withdrawMarketerFees, distributeAccruedFees, loading } = useVault();

    const fees = [
        { name: 'Company Wallet', share: '57%', amount: Number(globalConfig?.companyFees || 0) / 1e6, type: 'company', icon: Building2 },
        { name: 'Dev Wallet 1', share: '15%', amount: Number(globalConfig?.dev1Fees || 0) / 1e6, type: 'dev', index: 1, icon: Shield },
        { name: 'Dev Wallet 2', share: '10%', amount: Number(globalConfig?.dev2Fees || 0) / 1e6, type: 'dev', index: 2, icon: Shield },
        { name: 'Dev Wallet 3', share: '5%', amount: Number(globalConfig?.dev3Fees || 0) / 1e6, type: 'dev', index: 3, icon: Shield },
        { name: 'Marketer Wallet 1', share: '3%', amount: Number(globalConfig?.marketer1Fees || 0) / 1e6, type: 'marketer', icon: Megaphone },
        { name: 'Referral Pool', share: '10%', amount: referralPoolTotal || 0, type: 'referral', icon: Users },
    ];

    const sweepable = Number(globalConfig?.companyFees || 0)
        + Number(globalConfig?.dev1Fees || 0)
        + Number(globalConfig?.dev2Fees || 0)
        + Number(globalConfig?.dev3Fees || 0)
        + Number(globalConfig?.marketer1Fees || 0);
    const sweepableUsdc = sweepable / 1e6;

    const handleDistributeAll = async () => {
        try {
            await distributeAccruedFees();
            toast.success(`Swept $${sweepableUsdc.toFixed(2)} to all recipient wallets.`);
        } catch (err: any) {
            console.error('Distribute all failed:', err);
            toast.error('Distribute failed: ' + err.message);
        }
    };

    const handleWithdraw = async (item: any) => {
        try {
            if (item.type === 'company') {
                await withdrawCompanyFees(item.amount);
            } else if (item.type === 'dev') {
                await withdrawDevFees(item.index, item.amount);
            } else if (item.type === 'marketer') {
                await withdrawMarketerFees(item.amount);
            }
            toast.success(`Withdrawn ${item.amount.toFixed(2)} USDC successfully!`);
        } catch (err: any) {
            console.error('Withdrawal failed:', err);
            toast.error('Withdrawal failed: ' + err.message);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-300">
            <div className="bg-card border border-border rounded-3xl p-8 space-y-8 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                            <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold italic tracking-tight uppercase">Revenue Streams</h3>
                    </div>
                    <button
                        onClick={handleDistributeAll}
                        disabled={loading || sweepable <= 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40"
                        title="Permissionless: anyone can trigger this. Sweeps all 5 buckets in one tx."
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Distribute All (${sweepableUsdc.toFixed(2)})
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {fees.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={i} className="group flex justify-between items-center p-5 rounded-2xl bg-secondary/30 hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/50 group-hover:scale-110 transition-transform">
                                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{f.name}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">{f.share} Share</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg tabular-nums">${f.amount.toFixed(2)}</p>
                                    <button
                                        onClick={() => handleWithdraw(f)}
                                        disabled={f.amount <= 0 || loading || f.type === 'referral'}
                                        className="text-[10px] font-black uppercase tracking-tighter text-primary hover:underline disabled:text-muted-foreground/30 transition-all"
                                    >
                                        {f.type === 'referral' ? 'Manual claim only' : 'Withdraw Funds'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
