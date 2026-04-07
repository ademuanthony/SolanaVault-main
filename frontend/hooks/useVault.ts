'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction, AddressLookupTableProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, getAccount } from '@solana/spl-token';
import { SolanaVaultClient } from '@/sdk/vault';
import { buildJupiterCpi } from '@/sdk/jupiter';
import { buildOpenPositionCpi, buildClosePositionCpi, buildClaimSwapFeeCpi, toDlmmCpiData } from '@/sdk/meteora_dlmm';
import DLMM, { StrategyType } from '@meteora-ag/dlmm';
import { SolanaVault } from '../target/types/solana_vault';
import IDL from '../target/types/solana_vault.json';

export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || 'B3SnRh6Snmk7PvvRHu2o3wDQRpFf1DBMaR9zQpjL4LPx'
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

    /**
     * Calculate the real vault TVL from on-chain data:
     * vault USDC balance + all Meteora position values
     */
    const calculateRealTvl = async (): Promise<number> => {
        if (!program) throw new Error('Not initialized');
        const { globalConfigPda, vaultStatePda, vaultUsdcPda } = getPDAs();

        // 1. Vault USDC balance
        let vaultUsdc = 0;
        try {
            const bal = await connection.getTokenAccountBalance(vaultUsdcPda);
            vaultUsdc = Number(bal.value.amount);
        } catch { /* empty vault */ }

        // 2. Sum all Meteora position values
        let positionsValue = 0;
        if (activePositions.length > 0) {
            const DLMM = (await import('@meteora-ag/dlmm')).default;
            for (const pos of activePositions) {
                try {
                    const acct = pos.account;
                    const pool = await DLMM.create(connection, acct.dlmmPool);
                    const posData = await pool.getPosition(acct.positionNft);
                    if (!posData?.positionData) continue;

                    const mintX = pool.lbPair.tokenXMint;
                    const mintY = pool.lbPair.tokenYMint;
                    const xDec = mintX.toBase58() === 'So11111111111111111111111111111111111111112' ? 9 : 6;
                    const yDec = mintY.toBase58() === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 6 : 9;

                    const posX = Number(posData.positionData.totalXAmount?.toString() || '0') / Math.pow(10, xDec);
                    const posY = Number(posData.positionData.totalYAmount?.toString() || '0') / Math.pow(10, yDec);
                    const feeX = Number(posData.positionData.feeX?.toString() || '0') / Math.pow(10, xDec);
                    const feeY = Number(posData.positionData.feeY?.toString() || '0') / Math.pow(10, yDec);

                    const activeBin = await pool.getActiveBin();
                    const rawPrice = parseFloat(activeBin.price);
                    const priceXinY = rawPrice * Math.pow(10, xDec - yDec);

                    const valueUsdc = (posX + feeX) * priceXinY + posY + feeY;
                    positionsValue += Math.floor(valueUsdc * 1e6); // raw USDC
                } catch (e) {
                    console.warn('Could not value position:', e);
                }
            }
        }

        return vaultUsdc + positionsValue;
    };

    /**
     * Sync on-chain TVL with actual vault value.
     * Calls the update_tvl instruction with the real calculated value.
     */
    const syncTvl = async () => {
        if (!program || !publicKey) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();
            const realTvl = await calculateRealTvl();
            const currentTvl = Number(vaultState?.totalTvl || 0);

            console.log(`TVL sync: current=${currentTvl}, real=${realTvl}, delta=${realTvl - currentTvl}`);

            const tx = await (program.methods as any)
                .updateTvl(new BN(realTvl))
                .accounts({
                    admin: publicKey,
                    globalConfig: globalConfigPda,
                    vaultState: vaultStatePda,
                })
                .rpc();

            console.log('TVL sync success:', tx);
            await fetchState();
            return { tx, oldTvl: currentTvl, newTvl: realTvl };
        } catch (error) {
            console.error('TVL sync failed:', error);
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

            const { swapData, allMetas, addressLookupTableAccounts } = await buildJupiterCpi({
                connection,
                inputMint: inputMintPubkey,
                outputMint: outputMintPubkey,
                amount: amountParam,
                slippageBps,
                userPublicKey: globalConfigPda, // The vault PDA is the "user" in Jupiter's eyes
            });

            // Compute standard ATAs that Jupiter expects for the PDA
            const jupiterSourceAta = await getAssociatedTokenAddress(inputMintPubkey, globalConfigPda, true);
            const jupiterDestinationAta = await getAssociatedTokenAddress(outputMintPubkey, globalConfigPda, true);

            // Build pre-swap setup: ensure both standard ATAs exist (admin pays, PDA owns)
            const preInstructions: TransactionInstruction[] = [];

            const createAtaIx = (ata: PublicKey, mint: PublicKey) =>
                new TransactionInstruction({
                    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                    keys: [
                        { pubkey: publicKey, isSigner: true, isWritable: true },
                        { pubkey: ata, isSigner: false, isWritable: true },
                        { pubkey: globalConfigPda, isSigner: false, isWritable: false },
                        { pubkey: mint, isSigner: false, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.alloc(0),
                });

            // Create source ATA if it doesn't exist
            try { await getAccount(connection, jupiterSourceAta); } catch {
                preInstructions.push(createAtaIx(jupiterSourceAta, inputMintPubkey));
            }

            // Create destination ATA if it doesn't exist
            try { await getAccount(connection, jupiterDestinationAta); } catch {
                preInstructions.push(createAtaIx(jupiterDestinationAta, outputMintPubkey));
            }

            // Use V2: the on-chain handler transfers tokens between vault PDAs and standard ATAs
            const tx = await client.jupiterSwapV2({
                admin: publicKey,
                globalConfig: globalConfigPda,
                jupiterProgram: JUPITER_PROGRAM_ID,
                sourceTokenAccount,
                destinationTokenAccount,
                jupiterSourceAta,
                jupiterDestinationAta,
                swapData: swapData.data,
                swapAmount: new BN(amountParam.toString()),
                remainingAccounts: allMetas.map(m => ({
                    pubkey: m.pubkey,
                    isSigner: false,
                    isWritable: m.isWritable
                })),
                addressLookupTableAccounts,
                preInstructions,
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
        if (!program || !publicKey || !signTransaction) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();
            const poolPubkey = new PublicKey(poolAddress);
            const DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
            const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
            const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

            // Find next free position index
            const currentVaultState = await program.account.vaultState.fetch(vaultStatePda);
            let index = currentVaultState.positionsCount as number;
            let dlmmPositionPda!: PublicKey;
            while (true) {
                [dlmmPositionPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('dlmm_position'), Buffer.from([index])], PROGRAM_ID
                );
                if (!(await connection.getAccountInfo(dlmmPositionPda))) break;
                index++;
                if (index > 255) throw new Error("No free positions (max 255)");
            }

            // Generate position keypair
            const positionMintKeypair = Keypair.generate();

            // Get Meteora SDK instructions
            const dlmmPool = await (await import('@meteora-ag/dlmm')).default.create(connection, poolPubkey);
            const mintX = dlmmPool.lbPair.tokenXMint;
            const mintY = dlmmPool.lbPair.tokenYMint;
            const xDecimals = mintX.toBase58() === NATIVE_MINT.toBase58() ? 9 : 6;
            const yDecimals = mintY.toBase58() === USDC_MINT.toBase58() ? 6 : 9;
            const totalXRaw = BigInt(Math.floor(amountX * Math.pow(10, xDecimals)));
            const totalYRaw = BigInt(Math.floor(amountY * Math.pow(10, yDecimals)));

            const meteoraTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
                positionPubKey: positionMintKeypair.publicKey,
                user: globalConfigPda,
                totalXAmount: new BN(totalXRaw.toString()),
                totalYAmount: new BN(totalYRaw.toString()),
                strategy: { minBinId, maxBinId, strategyType },
            } as any);

            const ixs = meteoraTx.instructions ?? (meteoraTx as any).message?.instructions;
            const dlmmIxs = (ixs || []).filter((ix: any) => ix.programId.equals(DLMM_PROGRAM_ID));
            if (dlmmIxs.length === 0) throw new Error("No DLMM instructions from SDK");

            const initIx = dlmmIxs[0] as TransactionInstruction;
            const addLiqIx = dlmmIxs.length > 1 ? (dlmmIxs[1] as TransactionInstruction) : null;

            // Build initializePosition CPI data — replace payer (account[0]) with admin
            const initCpiData = {
                accounts: initIx.keys.map((k: any, i: number) => {
                    if (i === 0 && k.pubkey.equals(globalConfigPda)) {
                        return { pubkey: publicKey, isSigner: true, isWritable: true };
                    }
                    return { pubkey: k.pubkey, isSigner: k.isSigner, isWritable: k.isWritable };
                }),
                data: Buffer.from(initIx.data),
            };

            // Map UI strategy to Rust enum
            let dlmmMode = 0;
            if (strategyType === 1) dlmmMode = 2;
            else if (strategyType === 2) dlmmMode = 1;

            const params = {
                positionIndex: index,
                dlmmPool: poolPubkey,
                positionNft: positionMintKeypair.publicKey,
                binArrayLower: new PublicKey('11111111111111111111111111111111'),
                binArrayUpper: new PublicKey('11111111111111111111111111111111'),
                mode: { [dlmmMode === 0 ? 'spot' : dlmmMode === 1 ? 'bidAsk' : 'curve']: {} },
                binIdLower: minBinId,
                binIdUpper: maxBinId,
                tokenXAmount: new BN(totalXRaw.toString()),
                tokenYAmount: new BN(totalYRaw.toString()),
                ratio: 50,
                oneSided: Boolean(amountX === 0 || amountY === 0),
            };

            const initRemaining = initIx.keys.map((k: any) => {
                const key = k.pubkey.toBase58();
                let isSigner = false;
                if (key === positionMintKeypair.publicKey.toBase58()) isSigner = true;
                if (key === publicKey.toBase58()) isSigner = true;
                return { pubkey: k.pubkey, isSigner, isWritable: k.isWritable };
            });

            // ── TX1: Initialize position ──
            console.log('TX1: Building initializePosition...');
            const ix1 = await (program.methods as any)
                .openDlmmPosition(params, initCpiData)
                .accounts({
                    admin: publicKey,
                    globalConfig: globalConfigPda,
                    dlmmPosition: dlmmPositionPda,
                    vaultState: vaultStatePda,
                    dlmmProgram: DLMM_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(initRemaining)
                .instruction();

            const bh1 = await connection.getLatestBlockhash();
            const msg1 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: bh1.blockhash,
                instructions: [ix1],
            }).compileToV0Message();
            let tx1 = new VersionedTransaction(msg1);
            tx1.sign([positionMintKeypair]);
            tx1 = await signTransaction(tx1) as any;

            const txId1 = await connection.sendRawTransaction(tx1.serialize());
            console.log('TX1 sent:', txId1);
            await connection.confirmTransaction({ signature: txId1, blockhash: bh1.blockhash, lastValidBlockHeight: bh1.lastValidBlockHeight });
            console.log('TX1 confirmed: position initialized!');

            // ── TX2: Add liquidity (if SDK returned the instruction) ──
            if (addLiqIx) {
                console.log('TX2: Building addLiquidity...');

                // Ensure ATAs exist for globalConfigPda for BOTH pool tokens
                const { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } = await import('@solana/spl-token');
                const poolMints = [mintX, mintY];
                const ataIxs: TransactionInstruction[] = [];
                for (const mint of poolMints) {
                    const ata = await getAssociatedTokenAddress(mint, globalConfigPda, true);
                    if (!(await connection.getAccountInfo(ata))) {
                        console.log(`Creating ATA for mint ${mint.toBase58().slice(0, 8)}...`);
                        ataIxs.push(createAssociatedTokenAccountIdempotentInstruction(publicKey, ata, globalConfigPda, mint));
                    }
                }
                if (ataIxs.length > 0) {
                    const ataBh = await connection.getLatestBlockhash();
                    const ataMsg = new TransactionMessage({
                        payerKey: publicKey, recentBlockhash: ataBh.blockhash, instructions: ataIxs,
                    }).compileToV0Message();
                    let ataTx = new VersionedTransaction(ataMsg);
                    ataTx = await signTransaction(ataTx) as any;
                    const ataTxId = await connection.sendRawTransaction(ataTx.serialize());
                    await connection.confirmTransaction({ signature: ataTxId, blockhash: ataBh.blockhash, lastValidBlockHeight: ataBh.lastValidBlockHeight });
                    console.log('ATAs created');
                }

                // Swap USDC ATA → vault USDC PDA in CPI data and remaining accounts
                const globalConfigUsdcAta = await getAssociatedTokenAddress(USDC_MINT, globalConfigPda, true);
                const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
                    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()], PROGRAM_ID
                );

                const addLiqCpiAccounts = addLiqIx.keys.map((k: any) => {
                    let pubkey = k.pubkey;
                    if (pubkey.equals(globalConfigUsdcAta)) pubkey = vaultUsdcAccount;
                    return { pubkey, isSigner: k.isSigner, isWritable: k.isWritable };
                });

                const addLiqRemaining = addLiqIx.keys.map((k: any) => {
                    let pubkey = k.pubkey;
                    if (pubkey.equals(globalConfigUsdcAta)) pubkey = vaultUsdcAccount;
                    return { pubkey, isSigner: false, isWritable: k.isWritable };
                });

                // Manually encode claimDlmmFees instruction (Anchor buffer too small for 16 accounts)
                const discriminator = Buffer.from([102, 188, 67, 120, 236, 199, 117, 122]);
                const claimedAmountBuf = Buffer.alloc(8);
                const accountsLenBuf = Buffer.alloc(4);
                accountsLenBuf.writeUInt32LE(addLiqCpiAccounts.length);
                const accountsBufs = addLiqCpiAccounts.map((a: any) => {
                    const buf = Buffer.alloc(34);
                    (a.pubkey.toBuffer ? a.pubkey.toBuffer() : new PublicKey(a.pubkey).toBuffer()).copy(buf, 0);
                    buf[32] = a.isSigner ? 1 : 0;
                    buf[33] = a.isWritable ? 1 : 0;
                    return buf;
                });
                const dataLenBuf = Buffer.alloc(4);
                dataLenBuf.writeUInt32LE(addLiqIx.data.length);
                const ixData = Buffer.concat([discriminator, claimedAmountBuf, accountsLenBuf, ...accountsBufs, dataLenBuf, Buffer.from(addLiqIx.data)]);

                const ix2 = new TransactionInstruction({
                    programId: PROGRAM_ID,
                    keys: [
                        { pubkey: publicKey, isSigner: true, isWritable: true },
                        { pubkey: globalConfigPda, isSigner: false, isWritable: true },
                        { pubkey: dlmmPositionPda, isSigner: false, isWritable: true },
                        { pubkey: vaultStatePda, isSigner: false, isWritable: true },
                        { pubkey: DLMM_PROGRAM_ID, isSigner: false, isWritable: false },
                        ...addLiqRemaining,
                    ],
                    data: ixData,
                });

                // Get or create persistent ALT
                const allKeys = ix2.keys.map(k => k.pubkey);
                const { account: altAccount } = await getOrCreateAlt(allKeys);

                // Build and send TX2 with ALT + compute budget
                const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
                const bh2 = await connection.getLatestBlockhash();
                const msg2 = new TransactionMessage({
                    payerKey: publicKey, recentBlockhash: bh2.blockhash, instructions: [computeIx, ix2],
                }).compileToV0Message([altAccount]);
                let tx2 = new VersionedTransaction(msg2);
                tx2 = await signTransaction(tx2) as any;
                const txId2 = await connection.sendRawTransaction(tx2.serialize());
                console.log('TX2 sent:', txId2);
                await connection.confirmTransaction({ signature: txId2, blockhash: bh2.blockhash, lastValidBlockHeight: bh2.lastValidBlockHeight });
                console.log('TX2 confirmed: liquidity added!');
            }

            await fetchState();
            await fetchPositions();
            return txId1;

        } catch (error) {
            console.error('Open DLMM Position failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };


    /**
     * Get or create a persistent ALT for Meteora CPI operations.
     * Stored in localStorage to avoid paying ~0.005 SOL rent each time.
     * Extends the ALT with any new accounts not already in it.
     */
    const getOrCreateAlt = async (
        neededKeys: PublicKey[],
    ): Promise<{ address: PublicKey; account: any }> => {
        if (!publicKey || !signTransaction) throw new Error('Wallet not connected');

        const ALT_STORAGE_KEY = `vault_alt_${publicKey.toBase58()}`;
        const uniqueNeeded = [...new Set(neededKeys.map(k => k.toBase58()))].map(k => new PublicKey(k));

        // Try to load existing ALT from localStorage
        const storedAlt = typeof window !== 'undefined' ? localStorage.getItem(ALT_STORAGE_KEY) : null;
        if (storedAlt) {
            try {
                const altAddress = new PublicKey(storedAlt);
                const resp = await connection.getAddressLookupTable(altAddress);
                if (resp.value) {
                    const existingAddrs = new Set(resp.value.state.addresses.map(a => a.toBase58()));
                    const missing = uniqueNeeded.filter(k => !existingAddrs.has(k.toBase58()));

                    if (missing.length === 0) {
                        console.log('Reusing existing ALT:', altAddress.toBase58());
                        return { address: altAddress, account: resp.value };
                    }

                    // Extend with missing accounts
                    if (missing.length > 0) {
                        console.log(`Extending ALT with ${missing.length} new accounts...`);
                        const extendIxs: TransactionInstruction[] = [];
                        for (let i = 0; i < missing.length; i += 30) {
                            extendIxs.push(AddressLookupTableProgram.extendLookupTable({
                                lookupTable: altAddress, authority: publicKey, payer: publicKey,
                                addresses: missing.slice(i, i + 30),
                            }));
                        }
                        const bh = await connection.getLatestBlockhash();
                        let tx = new VersionedTransaction(new TransactionMessage({
                            payerKey: publicKey, recentBlockhash: bh.blockhash, instructions: extendIxs,
                        }).compileToV0Message());
                        tx = await signTransaction(tx) as any;
                        const txId = await connection.sendRawTransaction(tx.serialize());
                        await connection.confirmTransaction({ signature: txId, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });

                        // Wait for extension to be visible
                        for (let i = 0; i < 20; i++) {
                            await new Promise(r => setTimeout(r, 500));
                            const updated = await connection.getAddressLookupTable(altAddress);
                            if (updated.value && updated.value.state.addresses.length >= existingAddrs.size + missing.length) {
                                console.log('ALT extended:', updated.value.state.addresses.length, 'addresses');
                                return { address: altAddress, account: updated.value };
                            }
                        }
                        // Refetch one more time
                        const final = await connection.getAddressLookupTable(altAddress);
                        if (final.value) return { address: altAddress, account: final.value };
                    }
                }
            } catch (e) {
                console.warn('Stored ALT invalid, creating new one:', e);
            }
        }

        // Create new ALT
        console.log('Creating new persistent ALT...');
        const recentSlot = await connection.getSlot("finalized");
        const [createAltIx, altAddress] = AddressLookupTableProgram.createLookupTable({
            authority: publicKey, payer: publicKey, recentSlot,
        });
        const extendIxs: TransactionInstruction[] = [];
        for (let i = 0; i < uniqueNeeded.length; i += 30) {
            extendIxs.push(AddressLookupTableProgram.extendLookupTable({
                lookupTable: altAddress, authority: publicKey, payer: publicKey,
                addresses: uniqueNeeded.slice(i, i + 30),
            }));
        }

        const bh = await connection.getLatestBlockhash();
        let tx = new VersionedTransaction(new TransactionMessage({
            payerKey: publicKey, recentBlockhash: bh.blockhash, instructions: [createAltIx, ...extendIxs],
        }).compileToV0Message());
        tx = await signTransaction(tx) as any;
        const txId = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction({ signature: txId, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });

        // Store for reuse
        if (typeof window !== 'undefined') {
            localStorage.setItem(ALT_STORAGE_KEY, altAddress.toBase58());
        }
        console.log('Persistent ALT created:', altAddress.toBase58());

        // Wait for activation
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 500));
            const resp = await connection.getAddressLookupTable(altAddress);
            if (resp.value && resp.value.state.addresses.length > 0) {
                return { address: altAddress, account: resp.value };
            }
        }
        throw new Error("ALT failed to activate");
    };

    /**
     * Helper: send a Meteora CPI instruction via the claimDlmmFees handler with a persistent ALT.
     * Used for removeLiquidity, claimFees, addLiquidity, etc.
     */
    const sendMeteoraCpiWithAlt = async (
        meteoraIx: TransactionInstruction,
        dlmmPositionPda: PublicKey,
        globalConfigPda: PublicKey,
        vaultStatePda: PublicKey,
        accountSwaps?: Map<string, PublicKey>,
        claimedAmount: number = 0,
    ) => {
        if (!publicKey || !signTransaction) throw new Error('Wallet not connected');
        const DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

        // Build CPI accounts with optional swaps
        const cpiAccounts = meteoraIx.keys.map((k: any) => {
            let pubkey = k.pubkey;
            if (accountSwaps) {
                const swap = accountSwaps.get(pubkey.toBase58());
                if (swap) pubkey = swap;
            }
            return { pubkey, isSigner: k.isSigner, isWritable: k.isWritable };
        });

        const remainingAccounts = cpiAccounts.map((m: any) => ({
            pubkey: m.pubkey, isSigner: false, isWritable: m.isWritable,
        }));

        // Manually encode claimDlmmFees instruction
        const discriminator = Buffer.from([102, 188, 67, 120, 236, 199, 117, 122]);
        const claimedAmountBuf = Buffer.alloc(8);
        // Write claimed_amount as u64 little-endian
        const claimedBigInt = BigInt(Math.floor(claimedAmount));
        claimedAmountBuf.writeBigUInt64LE(claimedBigInt);
        const accountsLenBuf = Buffer.alloc(4);
        accountsLenBuf.writeUInt32LE(cpiAccounts.length);
        const accountsBufs = cpiAccounts.map((a: any) => {
            const buf = Buffer.alloc(34);
            (a.pubkey.toBuffer ? a.pubkey.toBuffer() : new PublicKey(a.pubkey).toBuffer()).copy(buf, 0);
            buf[32] = a.isSigner ? 1 : 0;
            buf[33] = a.isWritable ? 1 : 0;
            return buf;
        });
        const dataLenBuf = Buffer.alloc(4);
        dataLenBuf.writeUInt32LE(meteoraIx.data.length);
        const ixData = Buffer.concat([discriminator, claimedAmountBuf, accountsLenBuf, ...accountsBufs, dataLenBuf, Buffer.from(meteoraIx.data)]);

        const ix = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: globalConfigPda, isSigner: false, isWritable: true },
                { pubkey: dlmmPositionPda, isSigner: false, isWritable: true },
                { pubkey: vaultStatePda, isSigner: false, isWritable: true },
                { pubkey: DLMM_PROGRAM_ID, isSigner: false, isWritable: false },
                ...remainingAccounts,
            ],
            data: ixData,
        });

        // Get or create persistent ALT with all needed accounts
        const allKeys = ix.keys.map(k => k.pubkey);
        const { account: altAccount } = await getOrCreateAlt(allKeys);

        // Send CPI tx with ALT + compute budget
        const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
        const bh = await connection.getLatestBlockhash();
        let tx = new VersionedTransaction(new TransactionMessage({
            payerKey: publicKey, recentBlockhash: bh.blockhash, instructions: [computeIx, ix],
        }).compileToV0Message([altAccount]));
        tx = await signTransaction(tx) as any;
        const txId = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction({ signature: txId, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });

        return txId;
    };

    const closeDlmmPosition = async (positionPda: string) => {
        if (!program || !publicKey || !signTransaction || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();
            const dlmmPositionPda = new PublicKey(positionPda);
            const DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
            const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

            const positionAccount = await program.account.dlmmPosition.fetch(dlmmPositionPda);
            const poolPubkey = positionAccount.dlmmPool as PublicKey;
            const positionMint = positionAccount.positionNft as PublicKey;

            console.log("Close Position:", { pool: poolPubkey.toBase58(), positionMint: positionMint.toBase58() });

            // Load Meteora pool and position
            const dlmmPool = await (await import('@meteora-ag/dlmm')).default.create(connection, poolPubkey);

            // Account swaps: USDC ATA → vault USDC PDA
            const { getAssociatedTokenAddress: getAta } = await import('@solana/spl-token');
            const globalConfigUsdcAta = await getAta(USDC_MINT, globalConfigPda, true);
            const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()], PROGRAM_ID
            );
            const accountSwaps = new Map<string, PublicKey>();
            accountSwaps.set(globalConfigUsdcAta.toBase58(), vaultUsdcAccount);

            // Step 1: Remove all liquidity, claim fees, and close Meteora position
            // Uses shouldClaimAndClose to handle dust amounts that plain remove misses
            try {
                const posData = await dlmmPool.getPosition(positionMint);
                const hasLiquidity = posData?.positionData?.positionBinData?.some(
                    (b: any) => b.positionXAmount !== "0" || b.positionYAmount !== "0"
                );
                const hasFees = posData?.positionData?.feeX && !posData.positionData.feeX.isZero?.() ||
                    posData?.positionData?.feeY && !posData.positionData.feeY.isZero?.();

                if (hasLiquidity || hasFees) {
                    console.log("Step 1: Removing liquidity + claiming fees...");
                    const removeTxs = await dlmmPool.removeLiquidity({
                        user: globalConfigPda,
                        position: positionMint,
                        fromBinId: posData.positionData.lowerBinId,
                        toBinId: posData.positionData.upperBinId,
                        bps: new (await import('bn.js')).default(10000), // 100%
                        shouldClaimAndClose: true,
                    } as any);

                    // Extract all DLMM instructions from returned Transaction(s)
                    const txArray = Array.isArray(removeTxs) ? removeTxs : [removeTxs];
                    const allDlmmIxs: TransactionInstruction[] = [];
                    for (const rtx of txArray) {
                        const rixs = (rtx as any).instructions ?? (rtx as any).message?.instructions ?? [];
                        for (const rix of rixs) {
                            if (rix.programId && rix.programId.equals(DLMM_PROGRAM_ID)) {
                                allDlmmIxs.push(rix);
                            }
                        }
                    }

                    // Send each DLMM instruction via CPI (removeLiquidity, claimFee, closePosition)
                    for (let i = 0; i < allDlmmIxs.length; i++) {
                        console.log(`  Sending DLMM CPI ${i + 1}/${allDlmmIxs.length}...`);
                        await sendMeteoraCpiWithAlt(allDlmmIxs[i], dlmmPositionPda, globalConfigPda, vaultStatePda, accountSwaps);
                    }
                    console.log("Step 1 done: liquidity removed, fees claimed, Meteora position closed.");
                } else {
                    // No liquidity — just close the Meteora position directly
                    console.log("No liquidity — closing empty Meteora position...");
                    const cpiData = await buildClosePositionCpi({
                        connection, pool: poolPubkey, user: globalConfigPda, positionPubkey: positionMint,
                    });
                    // Swap rentReceiver (account[2]) to admin
                    const fixedAccounts = cpiData.accounts.map((a: any, i: number) => {
                        const pubkey = (i === 2 && a.pubkey.equals(globalConfigPda)) ? publicKey : a.pubkey;
                        return { pubkey, isSigner: a.isSigner, isWritable: a.isWritable };
                    });
                    const meteoraCloseIx = new TransactionInstruction({
                        programId: DLMM_PROGRAM_ID,
                        keys: fixedAccounts.map((a: any) => ({ pubkey: a.pubkey, isSigner: a.isSigner, isWritable: a.isWritable })),
                        data: Buffer.from(cpiData.data),
                    });
                    await sendMeteoraCpiWithAlt(meteoraCloseIx, dlmmPositionPda, globalConfigPda, vaultStatePda);
                }
            } catch (e: any) {
                console.warn("Meteora position cleanup:", e.message);
            }

            // Step 2: Close our program's DlmmPosition tracking account
            console.log("Step 2: Closing vault DlmmPosition account...");
            // Use closeDlmmPositionAccount which just closes the PDA (no Meteora CPI needed)
            // But closeDlmmPosition handler expects a Meteora CPI. Use a minimal no-op close.
            // Actually, we need a closePosition CPI. If Meteora position is already closed,
            // we use closeDlmmPositionAccount (which closes just the vault's tracking PDA).
            const tx = await (program.methods as any)
                .closeDlmmPositionAccount()
                .accounts({
                    admin: publicKey,
                    globalConfig: globalConfigPda,
                    dlmmPosition: dlmmPositionPda,
                    vaultState: vaultStatePda,
                })
                .rpc();

            console.log('Close Position Success:', tx);

            // Step 3: Close non-essential ATAs on globalConfigPda to reclaim rent.
            // We keep SOL and USDC ATAs since they're used by most positions.
            // Other token ATAs (created for specific pools) can be closed.
            // Note: ATA owner is globalConfigPda (a PDA), so closing requires invoke_signed.
            // The claimDlmmFees handler only forwards to Meteora, not SPL Token.
            // TODO: Add an on-chain "close PDA token account" instruction to reclaim ATA rent.
            const USDC_MINT_STR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            const SOL_MINT_STR = 'So11111111111111111111111111111111111111112';
            const poolMintX = dlmmPool.lbPair.tokenXMint.toBase58();
            const poolMintY = dlmmPool.lbPair.tokenYMint.toBase58();
            const nonStandardMints = [poolMintX, poolMintY].filter(
                m => m !== USDC_MINT_STR && m !== SOL_MINT_STR
            );
            if (nonStandardMints.length > 0) {
                console.log(`Note: ${nonStandardMints.length} non-standard ATA(s) on globalConfigPda could be closed to reclaim ~${(nonStandardMints.length * 0.002).toFixed(3)} SOL rent. Requires program upgrade.`);
            }

            await fetchState();
            await fetchPositions();
            return tx;
        } catch (error) {
            console.error('Close DLMM Position failed:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const claimDlmmFees = async (positionPda: string) => {
        if (!program || !publicKey || !signTransaction || !globalConfig) throw new Error('Not initialized');
        setLoading(true);
        try {
            const { globalConfigPda, vaultStatePda } = getPDAs();
            const DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
            const dlmmPosition = new PublicKey(positionPda);
            const positionAccount = await program.account.dlmmPosition.fetch(dlmmPosition);

            const poolPubkey = positionAccount.dlmmPool as PublicKey;
            const positionPubkey = positionAccount.positionNft as PublicKey;

            // Fetch actual fee amounts from Meteora to update TVL
            let feeValueUsdc = 0;
            try {
                const dlmmPool = await (await import('@meteora-ag/dlmm')).default.create(connection, poolPubkey);
                const posData = await dlmmPool.getPosition(positionPubkey);
                if (posData?.positionData) {
                    const mintX = dlmmPool.lbPair.tokenXMint;
                    const mintY = dlmmPool.lbPair.tokenYMint;
                    const xDecimals = mintX.toBase58() === 'So11111111111111111111111111111111111111112' ? 9 : 6;
                    const yDecimals = mintY.toBase58() === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? 6 : 9;

                    const feeX = posData.positionData.feeX ? Number(posData.positionData.feeX.toString()) / Math.pow(10, xDecimals) : 0;
                    const feeY = posData.positionData.feeY ? Number(posData.positionData.feeY.toString()) / Math.pow(10, yDecimals) : 0;

                    // Convert fees to USDC value
                    const activeBin = await dlmmPool.getActiveBin();
                    const rawPrice = parseFloat(activeBin.price);
                    const decimalMultiplier = Math.pow(10, xDecimals - yDecimals);
                    const priceXinY = rawPrice * decimalMultiplier;

                    feeValueUsdc = feeX * priceXinY + feeY;
                    console.log(`Fees to claim: ${feeX} X ($${(feeX * priceXinY).toFixed(4)}) + ${feeY} Y ($${feeY.toFixed(4)}) = $${feeValueUsdc.toFixed(4)} USDC`);
                }
            } catch (e) {
                console.warn('Could not fetch fee amounts, TVL will not be updated:', e);
            }

            // Convert USDC value to raw amount (6 decimals)
            const claimedAmountRaw = Math.floor(feeValueUsdc * 1e6);

            const cpiData = await buildClaimSwapFeeCpi({
                connection,
                pool: poolPubkey,
                user: globalConfigPda,
                positionPubkey,
            });

            if ((cpiData as any).isNoOp) {
                alert("No fees available to claim for this position.");
                setLoading(false);
                return;
            }

            // Reconstruct TransactionInstruction from CPI data for the helper
            const meteoraIx = new TransactionInstruction({
                programId: DLMM_PROGRAM_ID,
                keys: cpiData.accounts.map((a: any) => ({
                    pubkey: a.pubkey, isSigner: a.isSigner, isWritable: a.isWritable,
                })),
                data: Buffer.from(cpiData.data),
            });

            const txId = await sendMeteoraCpiWithAlt(
                meteoraIx, dlmmPosition, globalConfigPda, vaultStatePda,
                undefined, claimedAmountRaw
            );
            console.log(`Claim DLMM Fees success: ${txId}, TVL updated by ${claimedAmountRaw} (raw USDC)`);
            await fetchState();
            return txId;
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

    const fetchPositions = useCallback(async () => {
        if (!program || !vaultState) return;
        try {
            const count = Number(vaultState.positionsCount);
            // Always scan a few extra slots in case counter is stale
            const scanCount = Math.max(count + 5, 10);
            const pdas: PublicKey[] = [];
            for (let i = 0; i < scanCount; i++) {
                const [pda] = PublicKey.findProgramAddressSync(
                    [Buffer.from('dlmm_position'), Buffer.from([i])],
                    PROGRAM_ID
                );
                pdas.push(pda);
            }

            const accountInfos = await connection.getMultipleAccountsInfo(pdas);

            const validPositions = accountInfos.map((info, i) => {
                if (!info) return null;
                try {
                    let account;
                    try {
                        account = program.coder.accounts.decode("DlmmPosition", info.data);
                    } catch (e) {
                        console.warn(`Failed to decode with PascalCase, trying camelCase for index ${i}...`);
                        account = program.coder.accounts.decode("dlmmPosition", info.data);
                    }
                    return { publicKey: pdas[i], account };
                } catch (err) {
                    console.warn(`Failed to decode position ${i} (${pdas[i].toBase58()}):`, err);
                    return null;
                }
            }).filter(p => p !== null);

            setActivePositions(validPositions);
        } catch (e) {
            console.error("Failed to fetch positions:", e);
        }
    }, [program, vaultState, connection]);

    useEffect(() => {
        fetchPositions();
    }, [fetchPositions]);

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
        syncTvl,
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
