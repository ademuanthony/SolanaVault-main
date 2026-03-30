'use client';

import Link from 'next/link';
import { Shield, Twitter, Github, Globe } from 'lucide-react';

export function Footer() {
    return (
        <footer className="w-full border-t border-border bg-background/50 backdrop-blur-sm py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 font-bold text-xl text-primary">
                            <Shield className="h-6 w-6" />
                            <span>SolanaVault</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Professional grade yield optimization on Solana.
                            Secure, transparent, and built for growth.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">App</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
                            <li><Link href="/leaderboard" className="hover:text-primary transition-colors">Leaderboard</Link></li>
                            <li><Link href="/referral" className="hover:text-primary transition-colors">Referrals</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">Resources</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Analytics</a></li>
                            <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4">Connect</h4>
                        <div className="flex gap-4 text-muted-foreground">
                            <a href="#" className="hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
                            <a href="#" className="hover:text-primary transition-colors"><Github className="h-5 w-5" /></a>
                            <a href="#" className="hover:text-primary transition-colors"><Globe className="h-5 w-5" /></a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>© 2026 Solana Yield Vault. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-primary">Privacy Policy</a>
                        <a href="#" className="hover:text-primary">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
