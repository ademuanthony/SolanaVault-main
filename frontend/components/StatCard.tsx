import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string;
    icon: LucideIcon;
    trend?: string;
    description?: string;
}

export function StatCard({ label, value, icon: Icon, trend, description }: StatCardProps) {
    return (
        <div className="group relative overflow-hidden flex flex-col p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:border-primary/20 transition-all duration-500">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-125 transition-transform duration-700 hidden xs:block">
                <Icon className="h-20 lg:h-24 w-20 lg:w-24" />
            </div>

            <div className="flex items-center gap-3 lg:gap-4 mb-3 lg:mb-4 relative z-10">
                <div className="p-2.5 lg:p-3.5 rounded-xl lg:rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <Icon className="h-5 lg:h-6 w-5 lg:w-6" />
                </div>
                <p className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors truncate">{label}</p>
            </div>

            <div className="relative z-10">
                <div className="flex items-baseline gap-2 lg:gap-3 flex-wrap">
                    <p className="text-2xl lg:text-3xl font-black tracking-tighter tabular-nums break-words">{value}</p>
                    {trend && (
                        <span className="text-[9px] lg:text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                            {trend}
                        </span>
                    )}
                </div>
                {description && <p className="text-[10px] lg:text-[11px] text-muted-foreground mt-2 font-medium leading-relaxed">{description}</p>}
            </div>
        </div>
    );
}
