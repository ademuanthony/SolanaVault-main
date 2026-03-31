import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from 'react';
import { Providers } from "@/components/Providers";
import { ReferralTracker } from "@/components/ReferralTracker";
import { Toaster } from "@/components/ui/sonner";
import { AdminLayoutWrapper } from "@/components/AdminLayoutWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caifu — Solana Yield Vault",
  description: "Earn yield on your USDC with automated Meteora DLMM strategies. Secure, transparent, and built for growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Providers>
          <ReferralTracker />
          <AdminLayoutWrapper>
            {children}
          </AdminLayoutWrapper>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
