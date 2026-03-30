'use client';

import { useState, useEffect } from 'react';
import { Search, Shield, Ban, CheckCircle, Loader2, UserPlus, X, RefreshCw } from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from "sonner";
import clsx from 'clsx';

export function UserManagementTab() {
    const { fetchAllUsers, toggleUserFlag, adminRegisterUser, closeUserAccount } = useVault();
    const { publicKey } = useWallet();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [vaultLoading, setVaultLoading] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);

    // Registration Form State
    const [newWallet, setNewWallet] = useState('');
    const [newReferrer, setNewReferrer] = useState('');

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const allUsers = await fetchAllUsers();
            setUsers(allUsers || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(user =>
        user.wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.publicKey.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleFlag = async (wallet: string, currentStatus: boolean) => {
        try {
            setVaultLoading(true);
            await toggleUserFlag(wallet, !currentStatus);
            toast.success(currentStatus ? "User unflagged" : "User flagged");
            fetchUsers();
        } catch (e: any) {
            toast.error("Action failed: " + e.message);
        } finally {
            setVaultLoading(false);
        }
    };

    const handleAdminRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setVaultLoading(true);
            await adminRegisterUser(newWallet, newReferrer || null);
            toast.success("Identity registered via override");
            setShowRegisterForm(false);
            setNewWallet('');
            setNewReferrer('');
            fetchUsers();
        } catch (e: any) {
            toast.error(e.message || "Registration failed");
        } finally {
            setVaultLoading(false);
        }
    };

    return (
        <div className="space-y-4 lg:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 lg:gap-6 bg-card/60 backdrop-blur-md p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-border/50 shadow-lg">
                <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 lg:h-5 w-4 lg:w-5 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder="Search Identity..."
                        className="w-full pl-10 lg:pl-12 pr-4 lg:pr-6 py-3 lg:py-4 bg-secondary/30 border border-transparent rounded-xl lg:rounded-2xl text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-secondary/50 transition-all font-mono"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4 w-full">
                    <button
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        className="w-full sm:flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-primary text-primary-foreground rounded-xl lg:rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
                    >
                        {showRegisterForm ? <X className="w-4 h-4 lg:w-5 lg:h-5" /> : <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />}
                        <span className="whitespace-nowrap">{showRegisterForm ? 'Cancel Entry' : 'Manual Registry'}</span>
                    </button>
                    <div className="w-full sm:w-auto px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl bg-secondary/30 border border-border/50 flex justify-between sm:justify-center items-center gap-4">
                        <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground">Population</span>
                        <span className="text-sm lg:text-lg font-black italic tabular-nums">{users.length}</span>
                    </div>
                </div>
            </div>

            {showRegisterForm && (
                <div className="bg-card/80 border-2 border-primary/20 p-6 lg:p-10 rounded-2xl lg:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-top-2 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <h3 className="text-xl lg:text-2xl font-black italic tracking-tighter uppercase mb-6 lg:mb-8">Override Registry</h3>
                    <form onSubmit={handleAdminRegister} className="grid grid-cols-1 gap-4 lg:gap-8">
                        <div className="space-y-1.5 lg:space-y-2">
                            <label className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Destination Wallet</label>
                            <input
                                type="text"
                                required
                                placeholder="Paste Solana address"
                                className="w-full px-4 lg:px-6 py-3 lg:py-4 bg-secondary/50 border border-border/50 rounded-xl lg:rounded-2xl font-mono text-[10px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                                value={newWallet}
                                onChange={(e) => setNewWallet(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5 lg:space-y-2">
                            <label className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Referral Link (Optional)</label>
                            <input
                                type="text"
                                placeholder="Paste upstream address"
                                className="w-full px-4 lg:px-6 py-3 lg:py-4 bg-secondary/50 border border-border/50 rounded-xl lg:rounded-2xl font-mono text-[10px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                                value={newReferrer}
                                onChange={(e) => setNewReferrer(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={vaultLoading || !newWallet}
                            className="w-full py-4 lg:py-5 bg-black text-white rounded-xl lg:rounded-2xl font-black uppercase tracking-widest lg:tracking-[0.3em] text-[10px] lg:text-xs hover:bg-black/80 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-2"
                        >
                            {vaultLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                            Authorize Identity Creation
                        </button>
                    </form>
                </div>
            )}

            <div className="rounded-2xl lg:rounded-[2.5rem] border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-secondary/30">
                            <tr>
                                <th className="px-4 lg:px-8 py-4 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-[140px]">Identity</th>
                                <th className="px-4 lg:px-8 py-4 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right min-w-[100px]">Shares</th>
                                <th className="px-4 lg:px-8 py-4 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right min-w-[100px]">Ref Yield</th>
                                <th className="px-4 lg:px-8 py-4 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center min-w-[100px]">Referrer</th>
                                <th className="px-4 lg:px-8 py-4 lg:py-6 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center min-w-[100px]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 lg:px-8 py-10 lg:py-20 text-center">
                                        <Loader2 className="h-8 lg:h-10 w-8 lg:w-10 animate-spin mx-auto text-primary opacity-50" />
                                        <p className="mt-4 text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Chain State...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 lg:px-8 py-10 lg:py-20 text-center text-muted-foreground">
                                        <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest opacity-40">Zero Results Found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.publicKey} className="group hover:bg-primary/5 transition-all duration-300">
                                        <td className="px-4 lg:px-8 py-4 lg:py-6">
                                            <p className="font-mono text-[10px] lg:text-xs font-bold text-foreground group-hover:text-primary transition-colors">{user.wallet.slice(0, 4)}...{user.wallet.slice(-4)}</p>
                                            <p className="text-[8px] lg:text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-0.5 opacity-40">PDA: {user.publicKey.slice(0, 6)}</p>
                                        </td>
                                        <td className="px-4 lg:px-8 py-4 lg:py-6 text-right">
                                            <p className="text-[10px] lg:text-sm font-black tabular-nums">{(user.shares / 1e9).toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
                                        </td>
                                        <td className="px-4 lg:px-8 py-4 lg:py-6 text-right">
                                            <p className="text-[10px] lg:text-sm font-black text-emerald-500 tabular-nums">${(user.referralEarnings / 1e6).toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
                                        </td>
                                        <td className="px-4 lg:px-8 py-4 lg:py-6 text-center">
                                            {user.referrer === 'None' ? (
                                                <span className="text-[8px] lg:text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">- Direct -</span>
                                            ) : (
                                                <span className="font-mono text-[8px] lg:text-[10px] bg-secondary/50 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg border border-border/50 text-muted-foreground">
                                                    {user.referrer.slice(0, 4)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 lg:px-8 py-4 lg:py-6">
                                            <div className="flex justify-center gap-1.5 lg:gap-3">
                                                <button
                                                    onClick={() => handleToggleFlag(user.wallet, user.isFlagged)}
                                                    className={clsx(
                                                        "p-2 lg:p-3 rounded-lg lg:rounded-xl transition-all active:scale-90",
                                                        user.isFlagged
                                                            ? "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white shadow-sm"
                                                            : "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white shadow-sm"
                                                    )}
                                                    disabled={vaultLoading}
                                                >
                                                    {user.isFlagged ? <CheckCircle className="h-3.5 lg:h-4 w-3.5 lg:w-4" /> : <Ban className="h-3.5 lg:h-4 w-3.5 lg:w-4" />}
                                                </button>
                                                {(user.shares === 0 && user.unclaimedEarnings === 0) && (
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm("Atomic account closure will reclaim SOL rent. Continue?")) return;
                                                            try {
                                                                await closeUserAccount(user.wallet, user.wallet);
                                                                toast.success("Identity purged");
                                                                fetchUsers();
                                                            } catch (e: any) {
                                                                toast.error("Wail: " + e.message);
                                                            }
                                                        }}
                                                        className="p-2 lg:p-3 bg-secondary/50 hover:bg-destructive hover:text-white text-muted-foreground rounded-lg lg:rounded-xl transition-all active:scale-90"
                                                        disabled={vaultLoading}
                                                    >
                                                        <RefreshCw className={clsx("h-3.5 lg:h-4 w-3.5 lg:w-4", vaultLoading && "animate-spin")} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default UserManagementTab;
