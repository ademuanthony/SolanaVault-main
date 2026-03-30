'use client';

import Link from 'next/link';
import { ArrowRight, Vault, TrendingUp, ShieldCheck, Wallet, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { SolanaVault } from '@/target/types/solana_vault';
import idl from '@/target/types/solana_vault.json';
import { PROGRAM_ID } from '@/hooks/useVault'; // Ensure this is exported

export default function Home() {
  const { connection } = useConnection();
  const [stats, setStats] = useState({
    tvl: 0,
    apYear: 12.5, // Placeholder for now as APY requires historical data/indexing
    users: 0,
    loading: true
  });

  useEffect(() => {
    const fetchPublicStats = async () => {
      try {
        const provider = { connection, publicKey: PublicKey.default };
        const program = new Program(idl as any, provider) as unknown as Program<SolanaVault>;

        // Find Vault State PDA
        const [vaultStatePda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_state')],
          PROGRAM_ID
        );

        // Fetch Vault State
        const vaultAccount = await program.account.vaultState.fetch(vaultStatePda);

        // Fetch User Count (expensive, but okay for landing page initial load V1)
        // Optimization: In V2, store userCount in GlobalConfig or VaultState
        // For now, we fetch all accounts which is decent for <1000 users
        const userAccounts = await program.account.userAccount.all();

        setStats({
          tvl: Number(vaultAccount.totalTvl) / 1e6,
          apYear: 15.2, // Placeholder — calc based on fee growth if possible
          users: userAccounts.length,
          loading: false
        });
      } catch (e) {
        console.error("Failed to fetch public stats:", e);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchPublicStats();
  }, [connection]);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 lg:py-48 px-4 flex flex-col items-center text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl space-y-6"
        >
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <span>🚀 Live on Mainnet</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Unlock High Yields on Solana
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
            Deposit USDC and earn passive income through automated Meteora DLMM strategies.
            Secure, transparent, and built for growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Launch App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Learn More
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-12 border-t border-border/50 bg-secondary/20">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.loading ? (
            <div className="col-span-3 flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <StatCard label="Total Value Locked" value={`$${stats.tvl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Vault} />
              <StatCard label="Target APY" value={`${stats.apYear}%`} icon={TrendingUp} trend="+2.1%" />
              <StatCard label="Total Users" value={stats.users.toString()} icon={Users} />
            </>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="w-full py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Wallet}
              title="1. Connect & Deposit"
              description="Connect your Solana wallet and deposit USDC into the vault."
            />
            <FeatureCard
              icon={TrendingUp}
              title="2. Earn Yield"
              description="Your funds are automatically deployed into high-performing DLMM strategies."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="3. Withdraw Anytime"
              description="Withdraw your principal and profits whenever you want."
            />
          </div>
        </div>
      </section>
    </div>
  );

}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card hover:bg-accent/5 transition-colors">
      <div className="p-4 rounded-full bg-primary/10 mb-4">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

