'use client';

import { Users, User, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

// Raw data structure from useVault
interface ReferralData {
    wallet: any; // PublicKey
    totalReferralEarnings: any; // BN
    children?: ReferralData[];
    level: number;
}

export function ReferralTree({ referrals }: { referrals: ReferralData[] }) {
    if (!referrals || referrals.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Referral Network
                </h3>
                <div className="p-8 text-center text-muted-foreground italic bg-secondary/10 rounded-lg">
                    No referrals found yet. Share your link to start building your network!
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Referral Network
            </h3>
            <div className="overflow-x-auto">
                <div className="min-w-[500px] space-y-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/20 border border-primary/30 w-fit mb-4">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-mono text-sm">You (Root)</span>
                        </div>

                        <div className="pl-6 border-l border-border ml-3 space-y-3">
                            {referrals.map((ref, i) => (
                                <ReferralNode key={i} data={ref} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReferralNode({ data }: { data: ReferralData }) {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = data.children && data.children.length > 0;
    const walletStr = data.wallet.toBase58();
    const shortWallet = `${walletStr.slice(0, 4)}..${walletStr.slice(-4)}`;
    const earnings = (Number(data.totalReferralEarnings) / 1e6).toFixed(2);

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <div
                    className={`flex items-center gap-2 p-2 rounded-lg border w-fit transition-colors ${hasChildren ? 'cursor-pointer hover:bg-secondary/50' : ''} bg-secondary/30 border-border`}
                    onClick={() => hasChildren && setExpanded(!expanded)}
                >
                    {hasChildren ? (
                        expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <div className="w-4" /> // Spacer
                    )}

                    <span className="font-mono text-sm">{shortWallet}</span>
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">L{data.level}</span>
                    <span className="text-xs font-bold text-green-500 ml-2">
                        ${earnings}
                    </span>
                </div>
            </div>

            {hasChildren && expanded && (
                <div className="pl-6 border-l border-border ml-3 mt-2 space-y-3 animation-in slide-in-from-top-1">
                    {data.children!.map((child, i) => (
                        <ReferralNode key={i} data={child} />
                    ))}
                </div>
            )}
        </div>
    );
}
