'use client';

import { useState } from 'react';
import { Settings, DollarSign, Building2, Users, Gift, Loader2, Save, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import { useVault } from '@/hooks/useVault';
import { InputField } from '@/components/admin/InputField';

interface ConfigParams {
    tier1Threshold: number;
    tier2Threshold: number;
    tier1Fee: number;
    tier2Fee: number;
    tier3Fee: number;
    companyShare: number;
    dev1Share: number;
    dev2Share: number;
    dev3Share: number;
    marketer1Share: number;
    referralPoolShare: number;
    referralL1Share: number;
    referralL2Share: number;
    referralL3Share: number;
    referralL4Share: number;
    referralL5Share: number;
    welcomeBonusUser: number;
    welcomeBonusDev: number;
}

export function ConfigTab({ globalConfig }: { globalConfig: any }) {
    const { updateVaultConfig, loading } = useVault();
    const [params, setParams] = useState<ConfigParams>({
        tier1Threshold: globalConfig?.tier1Threshold ? Number(globalConfig.tier1Threshold) / 1e6 : 100,
        tier2Threshold: globalConfig?.tier2Threshold ? Number(globalConfig.tier2Threshold) / 1e6 : 500,
        tier1Fee: globalConfig?.tier1Fee || 70,
        tier2Fee: globalConfig?.tier2Fee || 60,
        tier3Fee: globalConfig?.tier3Fee || 50,
        companyShare: globalConfig?.companyShare || 57,
        dev1Share: globalConfig?.dev1Share || 15,
        dev2Share: globalConfig?.dev2Share || 10,
        dev3Share: globalConfig?.dev3Share || 5,
        marketer1Share: globalConfig?.marketer1Share || 3,
        referralPoolShare: globalConfig?.referralPoolShare || 10,
        referralL1Share: globalConfig?.referralL1Share || 40,
        referralL2Share: globalConfig?.referralL2Share || 25,
        referralL3Share: globalConfig?.referralL3Share || 15,
        referralL4Share: globalConfig?.referralL4Share || 12,
        referralL5Share: globalConfig?.referralL5Share || 8,
        welcomeBonusUser: globalConfig?.welcomeBonusUser ? Number(globalConfig.welcomeBonusUser) / 1e6 : 3.5,
        welcomeBonusDev: globalConfig?.welcomeBonusDev ? Number(globalConfig.welcomeBonusDev) / 1e6 : 0.5,
    });

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Dist shares = 100
        const totalDist = params.companyShare + params.dev1Share + params.dev2Share + params.dev3Share + params.marketer1Share + params.referralPoolShare;
        if (totalDist !== 100) {
            toast.error(`Total Distribution must be exactly 100%. Current: ${totalDist}%`);
            return;
        }

        // Validation: Referral shares = 100
        const totalRef = params.referralL1Share + params.referralL2Share + params.referralL3Share + params.referralL4Share + params.referralL5Share;
        if (totalRef !== 100) {
            toast.error(`Total Referral Distribution must be exactly 100%. Current: ${totalRef}%`);
            return;
        }

        try {
            await updateVaultConfig({
                tier1Threshold: params.tier1Threshold * 1e6,
                tier2Threshold: params.tier2Threshold * 1e6,
                tier1Fee: params.tier1Fee,
                tier2Fee: params.tier2Fee,
                tier3Fee: params.tier3Fee,
                companyShare: params.companyShare,
                dev1Share: params.dev1Share,
                dev2Share: params.dev2Share,
                dev3Share: params.dev3Share,
                marketer1Share: params.marketer1Share,
                referralPoolShare: params.referralPoolShare,
                referralL1Share: params.referralL1Share,
                referralL2Share: params.referralL2Share,
                referralL3Share: params.referralL3Share,
                referralL4Share: params.referralL4Share,
                referralL5Share: params.referralL5Share,
                welcomeBonusUser: params.welcomeBonusUser * 1e6,
                welcomeBonusDev: params.welcomeBonusDev * 1e6,
            });
            toast.success("Configuration updated successfully!");
        } catch (err: any) {
            toast.error("Failed to update config: " + err.message);
        }
    };

    const updateParam = (key: keyof ConfigParams, value: string) => {
        setParams(prev => ({ ...prev, [key]: Number(value) }));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex justify-between items-center bg-card/50 backdrop-blur-sm border border-border p-6 rounded-3xl sticky top-2 z-20 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/20 p-3 rounded-2xl">
                        <Settings className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold italic uppercase tracking-tight">Vault Configuration</h2>
                        <p className="text-xs text-muted-foreground uppercase font-medium tracking-widest opacity-60">Adjust global fee structures and logic parameters</p>
                    </div>
                </div>
                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_8px_32px_rgba(var(--primary-rgb),0.3)] disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Fee Tiers Section */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                        <div className="bg-blue-500/10 p-3 rounded-2xl">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Dynamic Tier Logic</h3>
                            <p className="text-sm text-muted-foreground">Thresholds determine how much performance fee to charge based on user TVL.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <InputField label="Tier 1 Threshold ($)" name="tier1Threshold" value={params.tier1Threshold.toString()} onChange={(e) => updateParam('tier1Threshold', e.target.value)} placeholder="100" />
                        <InputField label="Tier 2 Threshold ($)" name="tier2Threshold" value={params.tier2Threshold.toString()} onChange={(e) => updateParam('tier2Threshold', e.target.value)} placeholder="500" />
                        <InputField label="Tier 1 Fee (%)" name="tier1Fee" value={params.tier1Fee.toString()} onChange={(e) => updateParam('tier1Fee', e.target.value)} placeholder="70" />
                        <InputField label="Tier 2 Fee (%)" name="tier2Fee" value={params.tier2Fee.toString()} onChange={(e) => updateParam('tier2Fee', e.target.value)} placeholder="60" />
                        <InputField label="Tier 3 Fee (%)" name="tier3Fee" value={params.tier3Fee.toString()} onChange={(e) => updateParam('tier3Fee', e.target.value)} placeholder="50" />
                    </div>
                </div>

                {/* Performance Distribution Section */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                        <div className="bg-purple-500/10 p-3 rounded-2xl">
                            <Building2 className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Protocol Revenue Split</h3>
                            <p className="text-sm text-muted-foreground">Define how collected performance fees are distributed among stakeholders.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <InputField label="Company %" name="companyShare" value={params.companyShare.toString()} onChange={(e) => updateParam('companyShare', e.target.value)} />
                        <InputField label="Dev 1 %" name="dev1Share" value={params.dev1Share.toString()} onChange={(e) => updateParam('dev1Share', e.target.value)} />
                        <InputField label="Dev 2 %" name="dev2Share" value={params.dev2Share.toString()} onChange={(e) => updateParam('dev2Share', e.target.value)} />
                        <InputField label="Dev 3 %" name="dev3Share" value={params.dev3Share.toString()} onChange={(e) => updateParam('dev3Share', e.target.value)} />
                        <InputField label="Marketer %" name="marketer1Share" value={params.marketer1Share.toString()} onChange={(e) => updateParam('marketer1Share', e.target.value)} />
                        <InputField label="Ref Pool %" name="referralPoolShare" value={params.referralPoolShare.toString()} onChange={(e) => updateParam('referralPoolShare', e.target.value)} />
                    </div>
                </div>

                {/* Referral Level Section */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl">
                            <Users className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Referral Depth Ratios</h3>
                            <p className="text-sm text-muted-foreground">Splits the Referral Pool % across 5 levels of upstream referrers.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <InputField label="Level 1 %" name="referralL1Share" value={params.referralL1Share.toString()} onChange={(e) => updateParam('referralL1Share', e.target.value)} />
                        <InputField label="Level 2 %" name="referralL2Share" value={params.referralL2Share.toString()} onChange={(e) => updateParam('referralL2Share', e.target.value)} />
                        <InputField label="Level 3 %" name="referralL3Share" value={params.referralL3Share.toString()} onChange={(e) => updateParam('referralL3Share', e.target.value)} />
                        <InputField label="Level 4 %" name="referralL4Share" value={params.referralL4Share.toString()} onChange={(e) => updateParam('referralL4Share', e.target.value)} />
                        <InputField label="Level 5 %" name="referralL5Share" value={params.referralL5Share.toString()} onChange={(e) => updateParam('referralL5Share', e.target.value)} />
                    </div>
                </div>

                {/* Incentives Section */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                        <div className="bg-amber-500/10 p-3 rounded-2xl">
                            <Gift className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Acquisition Bonuses</h3>
                            <p className="text-sm text-muted-foreground">Set static bonus amounts to be minted for new user acquisition.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <InputField label="User Bonus ($)" name="welcomeBonusUser" value={params.welcomeBonusUser.toString()} onChange={(e) => updateParam('welcomeBonusUser', e.target.value)} />
                        <InputField label="Dev Bonus ($)" name="welcomeBonusDev" value={params.welcomeBonusDev.toString()} onChange={(e) => updateParam('welcomeBonusDev', e.target.value)} />
                    </div>
                </div>
            </form>

            <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-6 flex gap-4 animate-pulse">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                <div className="text-[12px] text-red-500/80 leading-relaxed font-semibold uppercase tracking-tight">
                    CRITICAL: Changes to these settings affect all real-time withdrawals across the platform immediately.
                    Ensure that Referral Pool + Protocol Revenue Shares always sum to exactly 100%.
                </div>
            </div>
        </div>
    );
}
