'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Keypair, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, getAccount } from '@solana/spl-token';
import { SolanaVaultClient } from '@/sdk/vault';
import { buildJupiterCpi } from '@/sdk/jupiter';
import { buildOpenPositionCpi, buildClosePositionCpi, buildClaimSwapFeeCpi, toDlmmCpiData } from '@/sdk/meteora_dlmm';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { SolanaVault } from '../target/types/solana_vault';
import IDL from '../target/types/solana_vault.json';

export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || 'CmhBENBj2c2rbAanfUvKGUzPZtffP7Q96hGH4eoAGqZp'
);
const JUPITER_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');


export function useVault() {
    const { connection } = useConnection();
    const { publicKey, signTransaction, signAllTransactions } = useWallet();
    const [loading, setLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [vaultState, setVaultState] = useState<any>(null);
    const [globalConfig, setGlobalConfig] = useState<any>(null);
    const [userAccount, setUserAccount] = useState<any>(null);
    const [referrals, setReferrals] = useState<any[]>([]);

    const provider = useMemo(() => {
        if (!publicKey || !signTransaction || !signAllTransactions) return null;
        return new AnchorProvider(
            connection,
            {
                publicKey,
                signTransaction,
                signAllTransactions,
            } as any,
            { preflightCommitment: 'processed' }
        );
    }, [connection, publicKey, signTransaction, signAllTransactions]);

    const program = useMemo(() => {
        if (!provider) return null;
        const prog = new Program(IDL as any, provider) as unknown as Program<SolanaVault>;

        // Debugging IDL and Coder
        try {
            console.log("Loaded IDL Version:", IDL.metadata.version);
            // Check if DlmmPosition exists in IDL
            const dlmmDef = (IDL as any).accounts?.find((a: any) => a.name === 'DlmmPosition');
            console.log("IDL DlmmPosition Def:", dlmmDef);

            // Check discriminator
            if (prog.coder && prog.coder.accounts) {
                const disc = prog.coder.accounts.memcmp('DlmmPosition'); // memcmp returns the discriminator (base58 or buffer?)
                // Actually BorshAccountsCoder.accountDiscriminator is internal mostly but we can calculate it
                // or just use decode to test
                console.log("Coder has accounts:", Object.keys(prog.account));
            }
        } catch (e) {
            console.error("Error inspecting program:", e);
        }
        return prog;
    }, [provider]);

    const client = useMemo(() => {
        if (!program) return null;
        return new SolanaVaultClient(program);
    }, [program]);

    const getPDAs = useCallback(() => {
        const [globalConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_config')],
            PROGRAM_ID
        );
        const [vaultStatePda] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_state')],
            PROGRAM_ID
        );
        const [vaultUsdcPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_usdc'), globalConfigPda.toBuffer()],
            PROGRAM_ID
        );
        let userAccountPda = null;
        if (publicKey) {
            [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), publicKey.toBuffer()],
                PROGRAM_ID
            );
        }
        return { globalConfigPda, vaultStatePda, vaultUsdcPda, userAccountPda };
    }, [publicKey]);

    const fetchState = useCallback(async () => {
        if (!program) return;

        try {
            const { globalConfigPda, vaultStatePda, userAccountPda } = getPDAs();

            try {
                console.log('Fetching vault state from:', vaultStatePda.toBase58());
                console.log('Fetching global config from:', globalConfigPda.toBase58());

                const [vState, gConfig] = await Promise.all([
                    program.account.vaultState.fetch(vaultStatePda),
                    program.account.globalConfig.fetch(globalConfigPda),
                ]);

                console.log('Vault states fetched successfully');
                setVaultState(vState);
                setGlobalConfig(gConfig);
                setIsInitialized(true);
            } catch (e: any) {
                // If account doesn't exist, it's just not initialized yet.
                if (e.message?.includes('Account does not exist')) {
                    console.log('Vault not yet initialized.');
                } else {
                    console.error('Vault state fetch failed:', e);
                }
                setVaultState(null);
                setGlobalConfig(null);
                setIsInitialized(false);
            }

            if (userAccountPda && publicKey) {
                try {
                    const uAcc = await program.account.userAccount.fetch(userAccountPda);
                    setUserAccount(uAcc);

                    // Recursive function to fetch referral tree (up to 5 levels)
                    const fetchReferralTree = async (referrerKey: PublicKey, level: number): Promise<any[]> => {
                        if (level > 5) return [];

                        // Fetch all accounts where referrer matches current key
                        const directRefs = await program.account.userAccount.all([
                            {
                                memcmp: {
                                    offset: 41, // 8 (disc) + 32 (wallet) + 1 (Option tag)
                                    bytes: referrerKey.toBase58(),
                                },
                            },
                        ]);

                        if (directRefs.length === 0) return [];

                        // For each direct referral, recursively fetch their referrals
                        // processing in parallel for speed
                        const results = await Promise.all(directRefs.map(async (ref) => {
                            const children = await fetchReferralTree(ref.account.wallet, level + 1);
                            return {
                                ...ref.account,
                                children: children,
                                level: level // Tag relative level
                            };
                        }));

                        return results;
                    };

                    console.log(`Fetching referral tree for ${publicKey.toBase58()}...`);
                    const referralTree = await fetchReferralTree(publicKey, 1);
                    console.log(`Discovered referral tree:`, referralTree);
                    setReferrals(referralTree);

                } catch (e) {
                    // User might not be registered yet, this is fine
                    setUserAccount(null);
                    setReferrals([]);
                }
            }
        } catch (error) {
            console.error('Core fetchState failure:', error);
        }
    }, [program, publicKey, getPDAs]);

    useEffect(() => {
        if (program) {
            fetchState();
        }
    }, [fetchState, program]);

    const deposit = async (amount: number) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Vault is not initialized or wallet not connected');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda, vaultUsdcPda, userAccountPda } = getPDAs();
            if (!userAccountPda) throw new Error('Wallet not connected');

            const usdcMint = globalConfig.usdcMint;
            const shareMint = globalConfig.shareMint;

            const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, publicKey);
            const userShareAccount = await getAssociatedTokenAddress(shareMint, publicKey);

            const tx = await client.deposit({
                user: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                userUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
                shareMint,
                userShareAccount,
                vaultState: vaultStatePda,
                amount: new BN(amount * 1e6), // Assuming 6 decimals for USDC
            });

            console.log('Deposit success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Deposit failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const withdraw = async (shares: number) => {
        if (!client || !publicKey || !globalConfig || !vaultState || !userAccount) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda, vaultUsdcPda, userAccountPda } = getPDAs();
            if (!userAccountPda) throw new Error('Wallet not connected');

            const usdcMint = globalConfig.usdcMint;
            const shareMint = globalConfig.shareMint;

            const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, publicKey);
            const userShareAccount = await getAssociatedTokenAddress(shareMint, publicKey);

            // Use integer math to avoid floating point precision issues
            const sharesRaw = Math.round(shares * 1e9);
            if (sharesRaw <= 0) throw new Error('Invalid share amount');

            // Pre-flight: ensure user has enough shares
            const userSharesRaw = Number(userAccount.shares);
            if (sharesRaw > userSharesRaw) {
                throw new Error(`Insufficient shares. You have ${(userSharesRaw / 1e9).toFixed(2)} shares, requested ${shares.toFixed(2)}.`);
            }

            // Pre-flight: ensure vault has enough USDC (vault may have TVL in DLMM positions)
            const totalTvl = Number(vaultState.totalTvl);
            const totalShares = Number(vaultState.totalShares);
            const sharePrice = totalShares > 0 ? (totalTvl * 1e9) / totalShares : 1e6;
            const usdcValueRaw = Math.floor((sharesRaw * sharePrice) / 1e9);

            let vaultUsdcBalance = BigInt(0);
            try {
                const vaultAcc = await getAccount(connection, vaultUsdcPda);
                vaultUsdcBalance = vaultAcc.amount;
            } catch (e) {
                console.warn('Could not fetch vault USDC balance:', e);
            }
            if (vaultUsdcBalance < BigInt(usdcValueRaw)) {
                throw new Error(
                    `Vault has insufficient USDC liquidity. ` +
                    `Required: ${(usdcValueRaw / 1e6).toFixed(2)} USDC. ` +
                    `Vault USDC balance may be in DLMM positions. Try a smaller amount or wait for admin to rebalance.`
                );
            }

            // Build referrer chain for fee distribution (up to 5 levels)
            const remainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
            let nextReferrer = userAccount.referrer;

            for (let i = 0; i < 5 && nextReferrer; i++) {
                const [referrerPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('user_account'), nextReferrer.toBuffer()],
                    PROGRAM_ID
                );

                try {
                    // Fetch the account FIRST to verify it exists and is initialized
                    // If this fails, the account doesn't exist, so we shouldn't add it to remainingAccounts
                    const refAcc = await program!.account.userAccount.fetch(referrerPda);

                    // Account exists, add to list
                    remainingAccounts.push({ pubkey: referrerPda, isWritable: true, isSigner: false });

                    // Set up next iteration
                    nextReferrer = refAcc.referrer;
                } catch (e) {
                    // Referrer not registered or other error - stop the chain here
                    console.log(`Referral chain ended at level ${i + 1}: referrer account not found`);
                    break;
                }
            }

            const tx = await client.withdraw({
                user: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                userUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
                shareMint,
                userShareAccount,
                vaultState: vaultStatePda,
                shares: new BN(sharesRaw),
                remainingAccounts: remainingAccounts.length > 0
                    ? remainingAccounts.map((a) => ({ pubkey: a.pubkey, isWritable: a.isWritable, isSigner: a.isSigner }))
                    : undefined,
            });

            console.log('Withdraw success:', tx);
            await fetchState();
            return tx;
        } catch (error: any) {
            const msg = error?.message || error?.toString?.() || 'Withdraw failed';
            if (msg.includes('0x1') || msg.includes('InsufficientFunds')) {
                throw new Error('Insufficient shares or vault liquidity. Try a smaller amount.');
            }
            if (msg.includes('0x0')) {
                throw new Error('Transaction simulation failed. Ensure your wallet has SOL for fees.');
            }
            console.error('Withdraw failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const claimReferralEarnings = async () => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultUsdcPda, userAccountPda } = getPDAs();
            if (!userAccountPda) throw new Error('Wallet not connected');

            const usdcMint = globalConfig.usdcMint;
            const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, publicKey);

            const tx = await client.claimReferralEarnings({
                user: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                userUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
            });

            console.log('Claim success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Claim failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const register = async (referrer: string | null = null) => {
        if (!client || !publicKey) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, userAccountPda } = getPDAs();
            if (!userAccountPda) throw new Error('Wallet not connected');

            let effectiveReferrer = referrer;
            if (!effectiveReferrer && typeof window !== 'undefined') {
                effectiveReferrer = localStorage.getItem('solana_vault_referrer');
            }

            // Prevent self-referral
            if (effectiveReferrer === publicKey.toBase58()) {
                console.log('Detected self-referral, ignoring.');
                effectiveReferrer = null;
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('solana_vault_referrer');
                }
            }

            const referrerPubkey = effectiveReferrer ? new PublicKey(effectiveReferrer) : null;

            const tx = await client.register({
                user: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                referrer: referrerPubkey,
            });

            console.log('Register success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Register failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const initialize = async (params: {
        companyWallet: string;
        dev1Wallet: string;
        dev1Authority: string;
        dev2Wallet: string;
        dev2Authority: string;
        dev3Wallet: string;
        dev3Authority: string;
        marketer1Wallet: string;
        marketer1Authority: string;
        usdcMint: string;
    }) => {
        if (!client || !publicKey) throw new Error('Wallet not connected');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda, vaultUsdcPda } = getPDAs();

            // Create share mint keypair
            const shareMintKeypair = Keypair.generate();
            const shareMint = shareMintKeypair.publicKey;

            const tx = await client.initialize({
                admin: publicKey,
                globalConfig: globalConfigPda,
                vaultState: vaultStatePda,
                usdcMint: new PublicKey(params.usdcMint),
                vaultUsdcAccount: vaultUsdcPda,
                shareMint: shareMint,
                companyWallet: new PublicKey(params.companyWallet),
                dev1Wallet: new PublicKey(params.dev1Wallet),
                dev1Authority: new PublicKey(params.dev1Authority),
                dev2Wallet: new PublicKey(params.dev2Wallet),
                dev2Authority: new PublicKey(params.dev2Authority),
                dev3Wallet: new PublicKey(params.dev3Wallet),
                dev3Authority: new PublicKey(params.dev3Authority),
                marketer1Wallet: new PublicKey(params.marketer1Wallet),
                marketer1Authority: new PublicKey(params.marketer1Authority),
            }, shareMintKeypair);

            console.log('Initialize success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Initialize failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const welcomeBonusDeposit = async (user: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda, vaultUsdcPda } = getPDAs();
            const userPubkey = new PublicKey(user);
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), userPubkey.toBuffer()],
                PROGRAM_ID
            );

            const usdcMint = globalConfig.usdcMint;
            const shareMint = globalConfig.shareMint;

            const adminUsdcAccount = await getAssociatedTokenAddress(usdcMint, publicKey);
            const userShareAccount = await getAssociatedTokenAddress(shareMint, userPubkey);
            const dev1UsdcAccount = await getAssociatedTokenAddress(usdcMint, globalConfig.dev1Wallet);
            const dev2UsdcAccount = await getAssociatedTokenAddress(usdcMint, globalConfig.dev2Wallet);
            const dev3UsdcAccount = await getAssociatedTokenAddress(usdcMint, globalConfig.dev3Wallet);

            const tx = await client.welcomeBonusDeposit({
                admin: publicKey,
                globalConfig: globalConfigPda,
                user: userPubkey,
                userAccount: userAccountPda,
                shareMint: shareMint,
                vaultState: vaultStatePda,
                remainingAccounts: [
                    { pubkey: adminUsdcAccount, isWritable: true, isSigner: false },
                    { pubkey: vaultUsdcPda, isWritable: true, isSigner: false },
                    { pubkey: userShareAccount, isWritable: true, isSigner: false },
                    { pubkey: dev1UsdcAccount, isWritable: true, isSigner: false },
                    { pubkey: dev2UsdcAccount, isWritable: true, isSigner: false },
                    { pubkey: dev3UsdcAccount, isWritable: true, isSigner: false },
                ],
            });

            console.log('Bonus deposit success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Bonus deposit failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const withdrawCompanyFees = async (amount: number) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultUsdcPda } = getPDAs();
            const companyUsdcAccount = await getAssociatedTokenAddress(globalConfig.usdcMint, globalConfig.companyWallet);

            const tx = await client.withdrawCompanyFees({
                admin: publicKey,
                globalConfig: globalConfigPda,
                companyUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
                amount: new BN(amount * 1e6),
            });

            console.log('Company fee withdrawal success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Company fee withdrawal failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const withdrawDevFees = async (devIndex: number, amount: number) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultUsdcPda } = getPDAs();
            const devWallet = devIndex === 1 ? globalConfig.dev1Wallet : devIndex === 2 ? globalConfig.dev2Wallet : globalConfig.dev3Wallet;
            const devAuthority = devIndex === 1 ? globalConfig.dev1Authority : devIndex === 2 ? globalConfig.dev2Authority : globalConfig.dev3Authority;
            const devUsdcAccount = await getAssociatedTokenAddress(globalConfig.usdcMint, devWallet);

            const tx = await client.withdrawDevFees({
                devAuthority,
                globalConfig: globalConfigPda,
                devUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
                devIndex,
                amount: new BN(amount * 1e6),
            });

            console.log(`Dev ${devIndex} fee withdrawal success:`, tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error(`Dev ${devIndex} fee withdrawal failed:`, error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const withdrawMarketerFees = async (amount: number) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultUsdcPda } = getPDAs();
            const marketerUsdcAccount = await getAssociatedTokenAddress(globalConfig.usdcMint, globalConfig.marketer1Wallet);

            const tx = await client.withdrawMarketerFees({
                marketerAuthority: globalConfig.marketer1Authority,
                globalConfig: globalConfigPda,
                marketerUsdcAccount,
                vaultUsdcAccount: vaultUsdcPda,
                amount: new BN(amount * 1e6),
            });

            console.log('Marketer fee withdrawal success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Marketer fee withdrawal failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const simulateYield = async (amount: number) => {
        if (!client || !publicKey) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();

            const tx = await client.simulateYield({
                admin: publicKey,
                globalConfig: globalConfigPda,
                vaultState: vaultStatePda,
                amount: new BN(amount * 1e6),
            });

            console.log('Yield simulation success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Yield simulation failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const jupiterSwap = async (
        inputMint: string,
        outputMint: string,
        amount: number, // Human readable amount (e.g. 1.5 SOL)
        slippageBps: number = 50 // 0.5%
    ) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);

        try {
            const { globalConfigPda } = getPDAs();
            const inputMintPubkey = new PublicKey(inputMint);
            const outputMintPubkey = new PublicKey(outputMint);

            // Convert amount to atomic units based on decimals (simplified for now, assume 6 for USDC, 9 for SOL)
            // Ideally we fetch mint info to get decimals
            const isSol = inputMintPubkey.equals(new PublicKey('So11111111111111111111111111111111111111112'));
            const decimals = isSol ? 9 : 6;
            const amountParam = BigInt(Math.floor(amount * (10 ** decimals)));

            // Get Associated Token Accounts for the VAULT (since vault is swapping)
            // Vault USDC account is a PDA: vaultUsdcPda
            // Vault SOL/Other account: we need to derive or likely use ATA owned by globalConfig authority?
            // Actually, for this vault, the "vault" calculates funds in `vaultUsdcAccount`.
            // If we swap USDC -> SOL, `source` is `vaultUsdcAccount`.
            // `destination` would be an ATA for SOL owned by... whom?
            // The contract `jupiter_swap` instruction uses `source_token_account` and `destination_token_account`.
            // Constraints:
            // source_token_account.owner == global_config (PDA) OR global_config.authority?
            // Actually `vault_usdc_account` is owned by `vault_state` or `global_config`?
            // Let's check `lib.rs` / `state.rs` owner.
            // `vault_usdc_account` seeds = [b"vault_usdc", global_config.key()].

            const { vaultUsdcPda } = getPDAs();

            let sourceTokenAccount: PublicKey;
            let destinationTokenAccount: PublicKey;

            // Simple logic for USDC <-> SOL for V1
            // If input is USDC: source = vaultUsdcPda
            // If output is SOL: destination = ATA for SOL owned by global_config?
            // The contract needs to own the accounts to sign for them via CPI.
            // The `vaultUsdcAccount` is a PDA derived from GlobalConfig, so GlobalConfig (or the program sign for it) owns it.

            // For arbitrary tokens, the Vault (GlobalConfig PDA) needs to own the ATAs.
            // We might need to create them if they don't exist.
            // For now, let's assume we are swapping Vault assets.

            if (inputMintPubkey.equals(globalConfig.usdcMint)) {
                sourceTokenAccount = vaultUsdcPda;
            } else {
                sourceTokenAccount = await getAssociatedTokenAddress(inputMintPubkey, globalConfigPda, true);
            }

            if (outputMintPubkey.equals(globalConfig.usdcMint)) {
                destinationTokenAccount = vaultUsdcPda;
            } else {
                destinationTokenAccount = await getAssociatedTokenAddress(outputMintPubkey, globalConfigPda, true);
            }

            console.log('Building Jupiter CPI...', {
                input: inputMint,
                output: outputMint,
                amount: amountParam.toString(),
                user: globalConfigPda.toBase58()
            });

            // Check for Devnet (or if fetch failed previously)
            const isDevnet = connection.rpcEndpoint.includes('devnet');
            if (isDevnet) {
                console.warn("Devnet Detected: Jupiter Quote API does not support Devnet. Simulating swap.");
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

                // MOCK SUCCESS
                console.log("Simulated Swap: Success");
                setLoading(false);
                return "devnet_simulated_swap_signature_" + Date.now();
            }

            const { swapData, allMetas } = await buildJupiterCpi({
                connection,
                inputMint: inputMintPubkey,
                outputMint: outputMintPubkey,
                amount: amountParam,
                slippageBps,
                userPublicKey: globalConfigPda, // The vault PDA is the "user" in Jupiter's eyes
            });

            const tx = await client.jupiterSwap({
                admin: publicKey,
                globalConfig: globalConfigPda,
                jupiterProgram: JUPITER_PROGRAM_ID,
                sourceTokenAccount,
                destinationTokenAccount,
                amount: new BN(amountParam.toString()),
                minimumAmountOut: new BN(0), // Handled by Jupiter's slippage checks usually, or pass from quote
                swapData,
                remainingAccounts: allMetas.map(m => ({
                    pubkey: m.pubkey,
                    isSigner: m.isSigner,
                    isWritable: m.isWritable
                }))
            });

            console.log('Jupiter Swap success:', tx);
            await fetchState();
            return tx;

        } catch (error) {
            console.error('Jupiter Swap failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const openDlmmPosition = async (
        poolAddress: string,
        minBinId: number,
        maxBinId: number,
        amountX: number,
        amountY: number,
        strategyType: number // UI: 0: Spot, 1: Curve, 2: BidAsk
    ) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            console.log('=== DLMM Position Creation Started ===');
            console.log('Input Parameters:', {
                poolAddress,
                minBinId,
                maxBinId,
                amountX,
                amountY,
                strategyType,
                strategyName: strategyType === 0 ? 'Spot' : strategyType === 1 ? 'Curve' : 'BidAsk'
            });

            const { globalConfigPda, vaultStatePda } = getPDAs();
            const poolPubkey = new PublicKey(poolAddress);

            console.log('PDAs:', {
                globalConfig: globalConfigPda.toBase58(),
                vaultState: vaultStatePda.toBase58(),
                admin: publicKey.toBase58()
            });

            // Fetch Vault State for index using a loop to find first free index
            const currentVaultState = await program!.account.vaultState.fetch(vaultStatePda);
            let index = currentVaultState.positionsCount;
            let dlmmPositionPda: PublicKey;
            let dlmmPositionSeedIndex: Buffer;

            // Look for the next available index
            while (true) {
                dlmmPositionSeedIndex = Buffer.from([index]);
                [dlmmPositionPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('dlmm_position'), dlmmPositionSeedIndex],
                    PROGRAM_ID
                );

                const info = await connection.getAccountInfo(dlmmPositionPda);
                if (!info) {
                    console.log(`Found free index: ${index}`);
                    break;
                }
                console.log(`Index ${index} already in use, skipping...`);
                index++;
                if (index > 255) throw new Error("No free positions available (max 255)");
            }

            console.log('Position Index & PDA:', {
                index,
                indexType: typeof index,
                dlmmPositionPda: dlmmPositionPda.toBase58()
            });

            // Convert amounts
            const totalX = BigInt(Math.floor(amountX * 1e6));
            const totalY = BigInt(Math.floor(amountY * 1e6));
            const totalXBN = new BN(totalX.toString());
            const totalYBN = new BN(totalY.toString());

            console.log('Amount Conversions:', {
                amountX,
                amountY,
                totalX: totalX.toString(),
                totalY: totalY.toString(),
                totalXBN: totalXBN.toString(),
                totalYBN: totalYBN.toString()
            });

            // Generate Position NFT Mint
            const positionMintKeypair = Keypair.generate();
            console.log('Position NFT Mint:', positionMintKeypair.publicKey.toBase58());

            // Map UI Strategy to Rust Enum
            // UI: 0=Spot, 1=Curve, 2=BidAsk
            // Rust: 0=Spot, 1=BidAsk, 2=Curve
            let dlmmMode = 0;
            if (strategyType === 1) dlmmMode = 2; // Curve
            else if (strategyType === 2) dlmmMode = 1; // BidAsk

            console.log('Strategy Mapping:', {
                uiStrategyType: strategyType,
                rustDlmmMode: dlmmMode,
                rustModeName: dlmmMode === 0 ? 'spot' : dlmmMode === 1 ? 'bidAsk' : 'curve'
            });

            // Build CPI data
            console.log('Building CPI data with Meteora SDK...');
            const cpiData = await buildOpenPositionCpi({
                connection,
                pool: poolPubkey,
                user: globalConfigPda,
                payer: publicKey, // Admin pays for rent
                positionPubkey: positionMintKeypair.publicKey,
                totalXAmount: totalX,
                totalYAmount: totalY,
                minBinId,
                maxBinId,
                strategyType: strategyType as StrategyType,
            });

            console.log('CPI Data from Meteora SDK:', {
                accountsCount: cpiData.accounts.length,
                dataLength: cpiData.data.length,
                dataHex: cpiData.data.toString('hex').substring(0, 100) + '...',
                signersCount: cpiData.signers?.length || 0,
                accounts: cpiData.accounts.map((a, i) => ({
                    index: i,
                    pubkey: a.pubkey.toBase58(),
                    isSigner: a.isSigner,
                    isWritable: a.isWritable
                }))
            });

            const params = {
                positionIndex: index,
                dlmmPool: poolPubkey,
                positionNft: positionMintKeypair.publicKey,
                binArrayLower: new PublicKey('11111111111111111111111111111111'),
                binArrayUpper: new PublicKey('11111111111111111111111111111111'),
                mode: { [dlmmMode === 0 ? 'spot' : dlmmMode === 1 ? 'bidAsk' : 'curve']: {} },
                binIdLower: minBinId,
                binIdUpper: maxBinId,
                tokenXAmount: totalXBN,
                tokenYAmount: totalYBN,
                ratio: 50,
                oneSided: false,
            };

            console.log('OpenDlmmPositionParams:', {
                positionIndex: params.positionIndex,
                dlmmPool: params.dlmmPool.toBase58(),
                positionNft: params.positionNft.toBase58(),
                binArrayLower: params.binArrayLower.toBase58(),
                binArrayUpper: params.binArrayUpper.toBase58(),
                mode: params.mode,
                binIdLower: params.binIdLower,
                binIdUpper: params.binIdUpper,
                tokenXAmount: params.tokenXAmount.toString(),
                tokenYAmount: params.tokenYAmount.toString(),
                ratio: params.ratio,
                oneSided: params.oneSided
            });

            // Replace placeholder fee payer
            const PLACEHOLDER_KEY = '3KMyzDtmtw3xxZ4ijMSDp54qiXmr1oMpYNJFxXaXYSzY';
            const fixedAccounts = cpiData.accounts.map(a => {
                if (a.pubkey.toString() === PLACEHOLDER_KEY) {
                    console.log('Replacing placeholder key with admin wallet:', publicKey.toBase58());
                    return { ...a, pubkey: publicKey };
                }
                return a;
            });

            const fixedCpiData = {
                ...cpiData,
                accounts: fixedAccounts
            };

            console.log('Fixed CPI Data:', {
                accountsCount: fixedCpiData.accounts.length,
                dataLength: fixedCpiData.data.length
            });

            const signers = [positionMintKeypair, ...(cpiData.signers || [])];
            console.log('Signers:', {
                count: signers.length,
                signers: signers.map(s => s.publicKey.toBase58())
            });

            console.log('Calling client.openDlmmPosition...');
            const tx = await client.openDlmmPosition({
                admin: publicKey,
                globalConfig: globalConfigPda,
                dlmmPosition: dlmmPositionPda,
                vaultState: vaultStatePda,
                dlmmProgram: new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
                params,
                cpiData: fixedCpiData,
                remainingAccounts: fixedCpiData.accounts.map(m => ({
                    pubkey: m.pubkey,
                    isSigner: m.isSigner,
                    isWritable: m.isWritable,
                }))
            }, signers);

            console.log('✅ Open Position Success:', tx);
            console.log('=== DLMM Position Creation Completed ===');
            await fetchState();
            return tx;

        } catch (error) {
            console.error('❌ Open DLMM Position failed:', error);
            console.error('Error details:', {
                name: (error as any)?.name,
                message: (error as any)?.message,
                code: (error as any)?.code,
                logs: (error as any)?.logs,
                stack: (error as any)?.stack
            });
            throw error;
        } finally {
            setLoading(false);
        }
    };


    const closeDlmmPosition = async (positionPda: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { vaultStatePda } = getPDAs();
            const dlmmPosition = new PublicKey(positionPda);

            // We need to fetch the position account to get the pool and position pubkey
            // However, the IDL might not expose the structure easily if it's dynamic
            // But we know 'vault' has 'dlmmPosition' account type.
            // Let's assume we can fetch it.
            // const posAccount = await program.account.dlmmPosition.fetch(dlmmPosition);
            // But we don't have the type imported easily here.

            // For now, we'll try to rely on the SDK helper if available, or just pass the PDA.
            // The contract instruction `close_dlmm_position` takes `cpi_data`.
            // `cpi_data` needs `pool`, `position_pubkey` (NFT mint usually), `user` (vault PDA).
            // This is tricky because `close_dlmm_position` expects us to pass the correct accounts for CPI.
            // If we don't know the Pool or Position Mint, we can't build the CPI.
            // WE MUST FETCH THE DLMM POSITION ACCOUNT DATA FIRST.

            if (!program) throw new Error('Program not initialized');
            const positionAccount = await program.account.dlmmPosition.fetch(dlmmPosition);
            console.log('Fetched DLMM Position Account:', JSON.stringify(positionAccount, null, 2));

            // Handle potential key casing issues (snake_case vs camelCase)
            // @ts-ignore
            const poolPubkey = (positionAccount.dlmmPool || positionAccount.dlmm_pool || positionAccount.pool) as PublicKey;
            // @ts-ignore
            const positionMint = (positionAccount.positionNft || positionAccount.position_nft || positionAccount.positionPubkey) as PublicKey;

            if (!poolPubkey || !positionMint) {
                console.error("Missing pool or position mint in account data", positionAccount);
                throw new Error("Invalid DlmmPosition account data");
            }

            // Ensure these are real PublicKeys (handle strings from JSON or decoding)
            const poolPubkeyObj = new PublicKey(poolPubkey);
            const positionMintObj = new PublicKey(positionMint);

            console.log("Preparing Close CPI with:", {
                pool: poolPubkeyObj.toBase58(),
                user: getPDAs().globalConfigPda.toBase58(),
                position: positionMintObj.toBase58(),
                payer: publicKey?.toBase58()
            });

            if (!publicKey) throw new Error("Wallet not connected");

            const cpiData = await buildClosePositionCpi({
                connection,
                pool: poolPubkeyObj,
                // The position on-chain is owned by the Admin (payer), not GlobalConfig (PDA).
                // Use publicKey (Admin) as the user/owner.
                user: publicKey,
                positionPubkey: positionMintObj,
                payer: publicKey,
            });

            const tx = await client.closeDlmmPosition({
                admin: publicKey,
                globalConfig: getPDAs().globalConfigPda,
                dlmmPosition: dlmmPosition, // The vault's tracking account
                vaultState: vaultStatePda,
                dlmmProgram: new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
                cpiData,
                remainingAccounts: (cpiData.accounts as any).map((m: any) => ({
                    pubkey: m.pubkey,
                    isSigner: m.isSigner,
                    isWritable: m.isWritable
                }))
            });

            console.log('Close Position Success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Close DLMM Position failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const claimDlmmFees = async (positionPda: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();
            const dlmmPosition = new PublicKey(positionPda);
            const positionAccount = await program!.account.dlmmPosition.fetch(dlmmPosition);

            const poolPubkey = positionAccount.dlmmPool as PublicKey;
            const positionPubkey = positionAccount.positionNft as PublicKey;

            const cpiData = await buildClaimSwapFeeCpi({
                connection,
                pool: poolPubkey,
                user: publicKey, // Position is owned by Admin
                positionPubkey,
            });

            if ((cpiData as any).isNoOp) {
                alert("No fees available to claim for this position.");
                setLoading(false);
                return;
            }

            // We need to provide the amount claimed for TVL tracking.
            // In a real scenario, we'd simulate or parse the amount from the claim result.
            // For now, we'll use a placeholder or 0 if we can't easily determine it before the TX.
            // Actually, the contract adds this to `total_tvl`.
            const tx = await client.claimDlmmFees({
                admin: publicKey,
                globalConfig: globalConfigPda,
                dlmmPosition,
                vaultState: vaultStatePda,
                dlmmProgram: new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'),
                claimedAmount: new BN(0), // Admin can update this manually if needed, or we fetch later
                cpiData,
                remainingAccounts: (cpiData.accounts as any).map((m: any) => ({
                    pubkey: m.pubkey,
                    isSigner: m.isSigner,
                    isWritable: m.isWritable
                }))
            });

            console.log('Claim DLMM Fees success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Claim DLMM Fees failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const flagUser = async (userWallet: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            const targetWallet = new PublicKey(userWallet);
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), targetWallet.toBuffer()],
                PROGRAM_ID
            );

            const tx = await client.flagUser({
                admin: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
            });

            console.log('Flag user success:', tx);
            return tx;
        } catch (error) {
            console.error('Flag user failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const unflagUser = async (userWallet: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            const targetWallet = new PublicKey(userWallet);
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), targetWallet.toBuffer()],
                PROGRAM_ID
            );

            const tx = await client.unflagUser({
                admin: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
            });

            console.log('Unflag user success:', tx);
            return tx;
        } catch (error) {
            console.error('Unflag user failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const toggleUserFlag = async (userWallet: string, isFlagged: boolean) => {
        if (isFlagged) {
            return await flagUser(userWallet);
        } else {
            return await unflagUser(userWallet);
        }
    };

    const fetchAllUsers = async () => {
        if (!program) return [];
        try {
            const all = await program.account.userAccount.all();
            return all.map(acc => ({
                ...acc.account,
                publicKey: acc.publicKey.toBase58(),
                wallet: acc.account.wallet.toBase58(),
                referrer: acc.account.referrer ? acc.account.referrer.toBase58() : 'None',
                shares: Number(acc.account.shares),
                unclaimedReferralEarnings: Number(acc.account.unclaimedReferralEarnings),
                totalReferralEarnings: Number(acc.account.totalReferralEarnings),
                referralEarnings: Number(acc.account.totalReferralEarnings), // Alias for UI
                unclaimedEarnings: Number(acc.account.unclaimedReferralEarnings), // Alias for UI
                isFlagged: acc.account.isFlagged,
            }));
        } catch (e) {
            console.error("Failed to fetch all users:", e);
            throw e;
        }
    };

    const adminRegisterUser = async (userWallet: string, referrer: string | null = null) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            const targetWallet = new PublicKey(userWallet);
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), targetWallet.toBuffer()],
                PROGRAM_ID
            );
            const referrerPubkey = referrer ? new PublicKey(referrer) : null;

            const tx = await client.adminRegisterUser({
                admin: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                userWallet: targetWallet,
                referrer: referrerPubkey,
            });

            console.log('Admin register user success:', tx);
            return tx;
        } catch (error) {
            console.error('Admin register user failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const closeUserAccount = async (userWallet: string, rentReceiver: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            const targetWallet = new PublicKey(userWallet);
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_account'), targetWallet.toBuffer()],
                PROGRAM_ID
            );

            const tx = await client.closeUserAccount({
                authority: publicKey,
                globalConfig: globalConfigPda,
                userAccount: userAccountPda,
                rentReceiver: new PublicKey(rentReceiver),
            });

            console.log('Close user account success:', tx);
            return tx;
        } catch (error) {
            console.error('Close user account failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const closeDlmmPositionAccount = async (positionPda: string) => {
        if (!client || !publicKey || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            const dlmmPosition = new PublicKey(positionPda);

            const tx = await client.closeDlmmPositionAccount({
                admin: publicKey,
                globalConfig: globalConfigPda,
                dlmmPosition,
            });

            console.log('Close DLMM position account success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Close DLMM position account failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const [activePositions, setActivePositions] = useState<any[]>([]);

    useEffect(() => {
        if (!program || !vaultState) return;
        const fetchPositions = async () => {
            try {
                const count = Number(vaultState.positionsCount);
                if (count === 0) {
                    setActivePositions([]);
                    return;
                }

                // Generate PDAs for all positions (0 to count + 5 to catch any ahead-of-counter positions)
                const scanCount = count + 5;
                const pdas: PublicKey[] = [];
                for (let i = 0; i < scanCount; i++) {
                    const [pda] = PublicKey.findProgramAddressSync(
                        [Buffer.from('dlmm_position'), Buffer.from([i])],
                        PROGRAM_ID
                    );
                    pdas.push(pda);
                }

                // Robust fetch: get account info and try to decode individually
                // This prevents one corrupt account from failing the entire fetch
                const accountInfos = await connection.getMultipleAccountsInfo(pdas);

                const validPositions = accountInfos.map((info, i) => {
                    if (!info) return null;
                    try {
                        let account;
                        try {
                            // Try PascalCase first
                            account = program.coder.accounts.decode("DlmmPosition", info.data);
                        } catch (e) {
                            // Fallback to camelCase
                            console.warn(`Failed to decode with PascalCase, trying camelCase for index ${i}...`);
                            account = program.coder.accounts.decode("dlmmPosition", info.data);
                        }
                        return {
                            publicKey: pdas[i],
                            account: account
                        };
                    } catch (err) {
                        console.warn(`Failed to decode position ${i} (${pdas[i].toBase58()}):`, err);
                        return null;
                    }
                }).filter(p => p !== null);

                setActivePositions(validPositions);
            } catch (e) {
                console.error("Failed to fetch positions:", e);
            }
        };
        fetchPositions();
    }, [program, vaultState, isInitialized]);

    const updateVaultConfig = async (params: any) => {
        if (!client || !publicKey) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda } = getPDAs();
            // Convert any number fields that should be BN
            const formattedParams = { ...params };
            if (formattedParams.tier1Threshold) formattedParams.tier1Threshold = new BN(formattedParams.tier1Threshold);
            if (formattedParams.tier2Threshold) formattedParams.tier2Threshold = new BN(formattedParams.tier2Threshold);
            if (formattedParams.welcomeBonusUser) formattedParams.welcomeBonusUser = new BN(formattedParams.welcomeBonusUser);
            if (formattedParams.welcomeBonusDev) formattedParams.welcomeBonusDev = new BN(formattedParams.welcomeBonusDev);

            const tx = await client.updateVaultConfig({
                admin: publicKey,
                globalConfig: globalConfigPda,
                params: formattedParams
            });
            console.log('Update config success:', tx);
            await fetchState();
            return tx;
        } catch (error) {
            console.error('Update config failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        client,
        program,
        loading,
        vaultState,
        globalConfig,
        userAccount,
        referrals,
        isInitialized,
        activePositions,
        deposit,
        withdraw,
        claimReferralEarnings,
        register,
        initialize,
        welcomeBonusDeposit,
        withdrawCompanyFees,
        withdrawDevFees,
        withdrawMarketerFees,
        simulateYield,
        jupiter_swap: jupiterSwap,
        openDlmmPosition,
        closeDlmmPosition,
        claimDlmmFees,
        flagUser,
        unflagUser,
        toggleUserFlag,
        fetchAllUsers,
        adminRegisterUser,
        closeUserAccount,
        closeDlmmPositionAccount,
        updateVaultConfig,
        fetchState,
        getPDAs,
        refresh: fetchState,
        publicKey,
        connected: !!publicKey,
    };
}
