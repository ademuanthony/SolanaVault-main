import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, AddressLookupTableAccount } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SolanaVault } from "../target/types/solana_vault";
import { JupiterSwapData } from "./jupiter";
import { DlmmCpiData, DlmmAccountMeta } from "./meteora_dlmm";

export interface InitializeArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  vaultState: PublicKey;
  usdcMint: PublicKey;
  vaultUsdcAccount: PublicKey;
  shareMint: PublicKey;
  companyWallet: PublicKey;
  dev1Wallet: PublicKey;
  dev1Authority: PublicKey;
  dev2Wallet: PublicKey;
  dev2Authority: PublicKey;
  dev3Wallet: PublicKey;
  dev3Authority: PublicKey;
  marketer1Wallet: PublicKey;
  marketer1Authority: PublicKey;
}

export interface RegisterArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  referrer?: PublicKey | null;
}

export interface DepositArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  shareMint: PublicKey;
  userShareAccount: PublicKey;
  vaultState: PublicKey;
  amount: BN;
}

export interface WithdrawArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  vaultState: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  userShareAccount: PublicKey;
  shareMint: PublicKey;
  shares: BN;
  remainingAccounts?: anchor.web3.AccountMeta[];
}

export interface ClaimReferralEarningsArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
}

export interface WelcomeBonusDepositArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  user: PublicKey;
  userAccount: PublicKey;
  shareMint: PublicKey;
  vaultState: PublicKey;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface SetCompanyWalletArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  newCompanyWallet: PublicKey;
}

export interface WithdrawCompanyFeesArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  companyUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  amount: BN;
}

export interface JupiterSwapArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  jupiterProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  amount: BN;
  minimumAmountOut: BN;
  swapData: JupiterSwapData;
  remainingAccounts: anchor.web3.AccountMeta[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}

export interface JupiterSwapV2Args {
  admin: PublicKey;
  globalConfig: PublicKey;
  jupiterProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  jupiterSourceAta: PublicKey;
  jupiterDestinationAta: PublicKey;
  /** Raw Jupiter instruction data bytes */
  swapData: Buffer;
  /** Amount to swap (transferred from vault PDA to standard ATA before swap) */
  swapAmount: BN;
  /** Jupiter swap accounts in exact order — passed as remainingAccounts */
  remainingAccounts: anchor.web3.AccountMeta[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  /** Pre-swap instructions (e.g. ATA creation) to include before the CPI */
  preInstructions?: TransactionInstruction[];
}

export interface OpenDlmmPositionArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  vaultState: PublicKey;
  dlmmProgram: PublicKey;
  params: any; // OpenDlmmPositionParams from IDL
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface CloseDlmmPositionArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  vaultState: PublicKey;
  dlmmProgram: PublicKey;
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface ClaimDlmmFeesArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  vaultState: PublicKey;
  dlmmProgram: PublicKey;
  claimedAmount: BN;
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface SetDevWalletArgs {
  devAuthority: PublicKey;
  globalConfig: PublicKey;
  devIndex: number;
  newWallet: PublicKey;
}

export interface WithdrawDevFeesArgs {
  devAuthority: PublicKey;
  globalConfig: PublicKey;
  devUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  devIndex: number;
  amount: BN;
}

export interface SetMarketerWalletArgs {
  marketerAuthority: PublicKey;
  globalConfig: PublicKey;
  newWallet: PublicKey;
}

export interface WithdrawMarketerFeesArgs {
  marketerAuthority: PublicKey;
  globalConfig: PublicKey;
  marketerUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  amount: BN;
}

export interface SimulateYieldArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  vaultState: PublicKey;
  amount: BN;
}

export interface FlagUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
}

export interface UnflagUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
}

export interface AdminRegisterUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userWallet: PublicKey;
  referrer: PublicKey | null;
}

export interface CloseUserAccountArgs {
  authority: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  rentReceiver: PublicKey;
}

export interface CloseDlmmPositionAccountArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
}

export interface UpdateConfigParams {
  admin: PublicKey | null;
  tier1Threshold: BN | null;
  tier2Threshold: BN | null;
  tier1Fee: number | null;
  tier2Fee: number | null;
  tier3Fee: number | null;
  companyShare: number | null;
  dev1Share: number | null;
  dev2Share: number | null;
  dev3Share: number | null;
  marketer1Share: number | null;
  referralPoolShare: number | null;
  referralL1Share: number | null;
  referralL2Share: number | null;
  referralL3Share: number | null;
  referralL4Share: number | null;
  referralL5Share: number | null;
  welcomeBonusUser: BN | null;
  welcomeBonusDev: BN | null;
}

export interface UpdateVaultConfigArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  params: UpdateConfigParams;
}

export class SolanaVaultClient {
  constructor(public readonly program: Program<SolanaVault>) { }

  async initialize(args: InitializeArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .initialize({
        companyWallet: args.companyWallet,
        dev1Wallet: args.dev1Wallet,
        dev1Authority: args.dev1Authority,
        dev2Wallet: args.dev2Wallet,
        dev2Authority: args.dev2Authority,
        dev3Wallet: args.dev3Wallet,
        dev3Authority: args.dev3Authority,
        marketer1Wallet: args.marketer1Wallet,
        marketer1Authority: args.marketer1Authority,
      })
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        vaultState: args.vaultState,
        usdcMint: args.usdcMint,
        vaultUsdcAccount: args.vaultUsdcAccount,
        shareMint: args.shareMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async register(args: RegisterArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .register(args.referrer ?? null)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        systemProgram: SystemProgram.programId,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async deposit(args: DepositArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .deposit(args.amount)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        shareMint: args.shareMint,
        userShareAccount: args.userShareAccount,
        vaultState: args.vaultState,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async withdraw(args: WithdrawArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .withdraw(args.shares)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        vaultState: args.vaultState,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        userShareAccount: args.userShareAccount,
        shareMint: args.shareMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });

    if (args.remainingAccounts?.length) request.remainingAccounts(args.remainingAccounts);
    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async claimReferralEarnings(args: ClaimReferralEarningsArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .claimReferralEarnings()
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async welcomeBonusDeposit(args: WelcomeBonusDepositArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .welcomeBonusDeposit()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        user: args.user,
        userAccount: args.userAccount,
        shareMint: args.shareMint,
        vaultState: args.vaultState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts);

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async setCompanyWallet(args: SetCompanyWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .setCompanyWallet(args.newCompanyWallet)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async withdrawCompanyFees(args: WithdrawCompanyFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .withdrawCompanyFees(args.amount)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        companyUsdcAccount: args.companyUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async jupiterSwap(args: JupiterSwapArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const ix = await methods
      .jupiterSwap(args.amount, args.minimumAmountOut, {
        accounts: args.swapData.accounts,
        data: args.swapData.data,
      })
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        jupiterProgram: args.jupiterProgram,
        sourceTokenAccount: args.sourceTokenAccount,
        destinationTokenAccount: args.destinationTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts)
      .instruction();

    // Build a v0 VersionedTransaction with address lookup tables to stay under 1232 bytes
    const provider = this.program.provider as anchor.AnchorProvider;
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    const lookupTables = args.addressLookupTableAccounts || [];

    const messageV0 = new TransactionMessage({
      payerKey: args.admin,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [ix],
    }).compileToV0Message(lookupTables);

    const versionedTx = new VersionedTransaction(messageV0);

    // Check size before signing to give a clear error
    const rawSize = versionedTx.serialize().length;
    console.log(`Jupiter swap tx size: ${rawSize} bytes (limit 1232), ALTs: ${lookupTables.length}, swap accounts: ${args.swapData.accounts.length}`);
    if (rawSize > 1232) {
      throw new Error(`Transaction too large: ${rawSize}/1232 bytes. Jupiter route uses too many accounts (${args.swapData.accounts.length}). Try a smaller or more common token pair.`);
    }

    if (signer) {
      versionedTx.sign([signer]);
    }

    if (provider.wallet.signTransaction) {
      const signed = await provider.wallet.signTransaction(versionedTx);
      const txId = await provider.connection.sendRawTransaction(signed.serialize());
      await provider.connection.confirmTransaction({
        signature: txId,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      return txId;
    }

    throw new Error("Wallet does not support signTransaction");
  }

  async jupiterSwapV2(args: JupiterSwapV2Args) {
    const methods: any = this.program.methods;
    const swapIx = await methods
      .jupiterSwapV2(args.swapData, args.swapAmount)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        jupiterProgram: args.jupiterProgram,
        sourceTokenAccount: args.sourceTokenAccount,
        destinationTokenAccount: args.destinationTokenAccount,
        jupiterSourceAta: args.jupiterSourceAta,
        jupiterDestinationAta: args.jupiterDestinationAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts)
      .instruction();

    // Build full instruction list: pre-instructions → swap CPI
    const instructions: TransactionInstruction[] = [
      ...(args.preInstructions || []),
      swapIx,
    ];

    const provider = this.program.provider as anchor.AnchorProvider;
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    const lookupTables = args.addressLookupTableAccounts || [];

    const messageV0 = new TransactionMessage({
      payerKey: args.admin,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message(lookupTables);

    const versionedTx = new VersionedTransaction(messageV0);

    const rawSize = versionedTx.serialize().length;
    console.log(`Jupiter swap v2 tx size: ${rawSize} bytes (limit 1232), ALTs: ${lookupTables.length}, remaining accounts: ${args.remainingAccounts.length}`);
    if (rawSize > 1232) {
      throw new Error(`Transaction too large: ${rawSize}/1232 bytes (${args.remainingAccounts.length} accounts).`);
    }

    if (provider.wallet.signTransaction) {
      const signed = await provider.wallet.signTransaction(versionedTx);
      const txId = await provider.connection.sendRawTransaction(signed.serialize());
      await provider.connection.confirmTransaction({
        signature: txId,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      return txId;
    }

    throw new Error("Wallet does not support signTransaction");
  }

  async openDlmmPosition(args: OpenDlmmPositionArgs, signers: anchor.web3.Signer[] = []) {
    console.log('[SDK] openDlmmPosition called with:', {
      admin: args.admin.toBase58(),
      globalConfig: args.globalConfig.toBase58(),
      dlmmPosition: args.dlmmPosition.toBase58(),
      vaultState: args.vaultState.toBase58(),
      dlmmProgram: args.dlmmProgram.toBase58(),
      remainingAccountsCount: args.remainingAccounts.length,
      signersCount: signers.length
    });

    const methods: any = this.program.methods;

    const ix = await methods
      .openDlmmPosition(args.params, args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        vaultState: args.vaultState,
        dlmmProgram: args.dlmmProgram,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(args.remainingAccounts)
      .instruction();

    const provider = this.program.provider as anchor.AnchorProvider;
    const latestBlockhash = await provider.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: args.admin,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);

    // Partial-sign with keypairs (e.g. position mint) BEFORE sending to wallet
    if (signers.length > 0) {
      console.log('[SDK] Partial-signing with keypairs:', signers.map(s => s.publicKey.toBase58()));
      versionedTx.sign(signers);
    }

    if (provider.wallet.signTransaction) {
      const signed = await provider.wallet.signTransaction(versionedTx);
      const txId = await provider.connection.sendRawTransaction(signed.serialize());
      await provider.connection.confirmTransaction({
        signature: txId,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      console.log('[SDK] Transaction successful:', txId);
      return txId;
    }

    throw new Error("Wallet does not support signTransaction");
  }

  async closeDlmmPosition(args: CloseDlmmPositionArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .closeDlmmPosition(args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        vaultState: args.vaultState,
        dlmmProgram: args.dlmmProgram,
      })
      .remainingAccounts(args.remainingAccounts);

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async claimDlmmFees(args: ClaimDlmmFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .claimDlmmFees(args.claimedAmount, args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        vaultState: args.vaultState,
        dlmmProgram: args.dlmmProgram,
      })
      .remainingAccounts(args.remainingAccounts);

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async setDevWallet(args: SetDevWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .setDevWallet(args.devIndex, args.newWallet)
      .accounts({
        devAuthority: args.devAuthority,
        globalConfig: args.globalConfig,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async withdrawDevFees(args: WithdrawDevFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .withdrawDevFees(args.devIndex, args.amount)
      .accounts({
        devAuthority: args.devAuthority,
        globalConfig: args.globalConfig,
        devUsdcAccount: args.devUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async setMarketerWallet(args: SetMarketerWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .setMarketerWallet(args.newWallet)
      .accounts({
        marketerAuthority: args.marketerAuthority,
        globalConfig: args.globalConfig,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async withdrawMarketerFees(args: WithdrawMarketerFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .withdrawMarketerFees(args.amount)
      .accounts({
        marketerAuthority: args.marketerAuthority,
        globalConfig: args.globalConfig,
        marketerUsdcAccount: args.marketerUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async simulateYield(args: SimulateYieldArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .simulateYield(args.amount)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        vaultState: args.vaultState,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async flagUser(args: FlagUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .flagUser()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async unflagUser(args: UnflagUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .unflagUser()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async adminRegisterUser(args: AdminRegisterUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .adminRegisterUser(args.userWallet, args.referrer)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        systemProgram: SystemProgram.programId,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async closeUserAccount(args: CloseUserAccountArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .closeUserAccount()
      .accounts({
        authority: args.authority,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        rentReceiver: args.rentReceiver,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async closeDlmmPositionAccount(args: CloseDlmmPositionAccountArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .closeDlmmPositionAccount()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }

  async updateVaultConfig(args: UpdateVaultConfigArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    const request = methods
      .updateVaultConfig(args.params)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
      });

    if (signer) request.signers([signer]);
    return request.rpc();
  }
}
